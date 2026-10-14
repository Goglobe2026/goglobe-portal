'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { DESTINATIONS, genId, money, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import { sourceStats, leadPayment, type SourceStats } from '@/lib/leadStats';
import { sheetCsvUrl } from '@/lib/leadImport';
import type { LeadSource } from '@/lib/types';

// Lead Sources: one Google Sheet link per ad form. Every Facebook / Instagram
// instant form asks different questions (UK, Schengen, Canada…), so each form
// gets its own link, tied to a country and a campaign, and its leads, answers
// and results are counted on their own.

type SourceStatus = {
  at: string; ok: boolean; rows: number; imported: number; duplicates: number; incomplete: number; tooOld: number; tagged: number;
  error?: string; lastOkAt?: string; totalImported: number;
};
type SyncInfo = { auto: boolean; everyMinutes: number; lastRunAt: string; nextRunAt: string; status: Record<string, SourceStatus> };
type SheetOutcome = { sourceId: string; label: string; rows: number; imported: number; duplicates: number; incomplete: number; tooOld: number; tagged: number; error?: string };
type SyncResult = { ok: boolean; message: string; sheets: SheetOutcome[] };

const EVERY_OPTIONS: [number, string][] = [[5, 'every 5 minutes'], [15, 'every 15 minutes'], [30, 'every 30 minutes'], [60, 'every hour'], [360, 'every 6 hours'], [1440, 'once a day']];
const SINCE_OPTIONS: [number, string][] = [[7, 'Only the last 7 days'], [14, 'Only the last 14 days'], [30, 'Only the last 30 days'], [60, 'Only the last 60 days'], [90, 'Only the last 90 days'], [0, 'Everything in the sheet']];

function ago(iso?: string): string {
  if (!iso) return '';
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
function inTime(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60000);
  if (mins <= 0) return 'any moment now';
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `in ${hrs} h` : `in ${Math.round(hrs / 24)} d`;
}
const pctText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[22px] font-bold mt-1" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone: 'green' | 'gold' | 'red' | 'grey' }) {
  const st = { green: ['var(--green-50)', 'var(--green)'], gold: ['var(--gold-50)', '#8a5a12'], red: ['var(--red-50)', 'var(--red)'], grey: ['#F0F1F4', 'var(--muted)'] }[tone];
  return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap" style={{ background: st[0], color: st[1] }}>{text}</span>;
}

export function LeadSources() {
  const { session, team } = useAppData();
  const admin = session?.type === 'ceo' || (session?.type === 'employee' && !!team.find(t => t.id === session.staffId)?.isAdmin);
  if (!admin) {
    return <EmptyState title="Lead sources are for the Head Manager" body="The sheet links give access to your lead data, so only the Head Manager and admins can manage them." />;
  }
  return <LeadSourcesInner />;
}

function LeadSourcesInner() {
  const { leadSources, setLeadSources, leads, campaigns, cases, sheetSyncUrl, setSheetSyncUrl, refresh } = useAppData();
  const toast = useToast();
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [infoError, setInfoError] = useState('');
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<LeadSource | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  const loadInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/lead-sources', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setInfoError(data.error || 'Could not load sync status'); return; }
      setInfo(data); setInfoError('');
    } catch { setInfoError('Could not reach the server'); }
  }, []);
  useEffect(() => {
    loadInfo();
    const t = setInterval(loadInfo, 60000);
    return () => clearInterval(t);
  }, [loadInfo]);

  async function runSync(sourceId?: string): Promise<boolean> {
    setBusy(sourceId || 'all');
    setResult(null);
    try {
      // A source that was only just saved may take a moment to reach the server.
      let res = await fetch('/api/sync-sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sourceId ? { sourceId } : {}) });
      if (res.status === 404 && sourceId) {
        await new Promise(r => setTimeout(r, 1200));
        res = await fetch('/api/sync-sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }) });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error || 'Something went wrong', sheets: data.sheets || [] });
        return false;
      }
      const bits = [`Added ${data.imported} new lead${data.imported === 1 ? '' : 's'}`];
      if (data.duplicates) bits.push(`${data.duplicates} already in the portal`);
      if (data.tooOld) bits.push(`${data.tooOld} older than the limit skipped`);
      if (data.incomplete) bits.push(`${data.incomplete} missing a name or phone`);
      setResult({ ok: true, message: bits.join(' · '), sheets: data.sheets || [] });
      await refresh(['leads', 'campaigns']);
      return true;
    } catch {
      setResult({ ok: false, message: 'Could not reach the server', sheets: [] });
      return false;
    } finally {
      setBusy('');
      loadInfo();
    }
  }

  async function saveConfig(p: { auto?: boolean; everyMinutes?: number }) {
    try {
      const res = await fetch('/api/lead-sources', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Could not save'); return; }
      toast(p.auto === false ? 'Automatic sync switched off' : 'Saved');
      loadInfo();
    } catch { toast('Could not reach the server'); }
  }

  const rows = useMemo(
    () => leadSources.map(src => ({ src, st: sourceStats(src, leads, campaigns, cases, leadSources) })),
    [leadSources, leads, campaigns, cases],
  );
  const unlinked = useMemo(() => sourceStats(null, leads, campaigns, cases, leadSources), [leads, campaigns, cases, leadSources]);

  const total = useMemo(() => rows.reduce((t, { st }) => ({
    leads: t.leads + st.leads, waiting: t.waiting + st.waiting, converted: t.converted + st.converted,
    revenue: t.revenue + st.revenue, outstanding: t.outstanding + st.outstanding, spend: t.spend + st.spend,
  }), { leads: 0, waiting: 0, converted: 0, revenue: 0, outstanding: 0, spend: 0 }), [rows]);

  const byCountry = useMemo(() => {
    const m = new Map<string, { country: string; sources: number; leads: number; contacted: number; converted: number; spend: number; revenue: number; outstanding: number }>();
    for (const { src, st } of rows) {
      const key = src.country || 'Not set';
      const cur = m.get(key) || { country: key, sources: 0, leads: 0, contacted: 0, converted: 0, spend: 0, revenue: 0, outstanding: 0 };
      cur.sources++; cur.leads += st.leads; cur.contacted += st.contacted; cur.converted += st.converted;
      cur.spend += st.spend; cur.revenue += st.revenue; cur.outstanding += st.outstanding;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.leads - a.leads);
  }, [rows]);

  // Links typed into the older "Sync from Google Sheet" box that are not lead sources yet.
  const legacyLinks = useMemo(() => {
    const have = new Set(leadSources.map(s => sheetCsvUrl(s.url).url).filter(Boolean));
    return (sheetSyncUrl || '').split(/\s*\n\s*/).map(s => s.trim()).filter(Boolean).filter(l => {
      const u = sheetCsvUrl(l).url;
      return !u || !have.has(u);
    });
  }, [leadSources, sheetSyncUrl]);

  function adoptLegacy() {
    const good = legacyLinks.filter(l => sheetCsvUrl(l).url);
    if (!good.length) { toast('None of those links can be used'); return; }
    const start = leadSources.length;
    const fresh: LeadSource[] = good.map((url, i) => ({
      id: genId('ls'), name: `Imported sheet ${start + i + 1}`, country: '', campaign: '', url, active: true, sinceDays: 30, createdAt: today(),
    }));
    setLeadSources(prev => [...prev, ...fresh]);
    const bad = legacyLinks.filter(l => !sheetCsvUrl(l).url);
    setSheetSyncUrl(bad.join('\n'));
    toast(`${fresh.length} link${fresh.length === 1 ? '' : 's'} turned into lead sources — open Edit on each to give it a name, country and campaign`);
  }

  const open = openId === '__none' ? null : leadSources.find(s => s.id === openId) || null;
  const activeCount = leadSources.filter(s => s.active !== false).length;

  return (
    <div>
      <SectionHead title="Lead sources — one link per ad form" count={`${activeCount} active · ${leadSources.length} in total`} action={
        <div className="flex gap-2 ml-auto">
          <button className="btn btn-sm" onClick={() => runSync()} disabled={!!busy || !activeCount}>{busy === 'all' ? 'Syncing…' : 'Sync all now'}</button>
          <button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}>+ Add lead source</button>
        </div>
      } />

      {rows.length > 0 && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <Tile label="Leads from your forms" value={String(total.leads)} sub={`${total.waiting} still waiting for a first contact`} />
          <Tile label="Became clients" value={String(total.converted)} sub={total.leads ? `${pctText(Math.round((total.converted / total.leads) * 1000) / 10)} of those leads` : undefined} color="var(--green)" />
          <Tile label="Collected from them" value={money(total.revenue)} sub="paid so far on their files" />
          <Tile label="Still to collect" value={money(total.outstanding)} sub="balance left on those files" color={total.outstanding > 0 ? 'var(--gold)' : undefined} />
        </div>
      )}

      <div className="card mb-4" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] font-medium" style={{ margin: 0 }}>
            <input type="checkbox" className="!w-auto" checked={!!info?.auto} disabled={!info} onChange={e => saveConfig({ auto: e.target.checked })} />
            Bring in new leads automatically
          </label>
          <select style={{ width: 'auto' }} value={info?.everyMinutes ?? 15} disabled={!info} onChange={e => saveConfig({ everyMinutes: Number(e.target.value) })}>
            {EVERY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="text-[12px] text-[var(--muted)] ml-auto">
            {infoError ? <span style={{ color: 'var(--red)' }}>{infoError}</span>
              : info?.auto
                ? <>{info.lastRunAt ? `Last automatic check ${ago(info.lastRunAt)}` : 'No automatic check yet'}{info.nextRunAt ? ` · next ${inTime(info.nextRunAt)}` : ''}</>
                : 'Automatic checking is off — use Sync all now.'}
          </div>
        </div>
        <div className="text-[11.5px] text-[var(--faint)] mt-1.5">The portal reads each sheet by itself, so a lead from an ad appears here without anyone pressing a button. A lead already in the portal is never added twice.</div>
      </div>

      {legacyLinks.length > 0 && (
        <div className="card mb-4" style={{ background: 'var(--gold-50)' }}>
          <div className="text-[13px]"><b>{legacyLinks.length} older sheet link{legacyLinks.length === 1 ? '' : 's'}</b> {legacyLinks.length === 1 ? 'is' : 'are'} still in the old “Sync from Google Sheet” box. Turn {legacyLinks.length === 1 ? 'it' : 'them'} into lead sources so each form shows its own numbers.</div>
          <button className="btn btn-sm mt-2" onClick={adoptLegacy}>Turn into lead sources</button>
        </div>
      )}

      {result && (
        <div className="card mb-4" style={{ background: result.ok ? 'var(--green-50)' : 'var(--red-50)' }}>
          <div className="text-[13px] font-medium" style={{ color: result.ok ? 'var(--green)' : 'var(--red)' }}>{result.message}</div>
          {result.sheets.length > 1 && result.sheets.map((o, i) => (
            <div key={i} className="text-[12px] mt-1 text-[var(--ink)]">
              <b>{o.label}</b>{' — '}{o.error ? <span style={{ color: 'var(--red)' }}>{o.error}</span> : <span className="text-[var(--muted)]">{o.imported} added · {o.duplicates} already there · {o.rows} rows</span>}
            </div>
          ))}
        </div>
      )}

      {!rows.length ? (
        <EmptyState
          title="No lead sources yet"
          body="Each ad form (UK, Schengen, Canada…) asks different questions, so give each one its own sheet link. Choose its country and campaign, and the portal brings in the leads, keeps every answer, and shows how each form performs."
          action={<button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add your first lead source</button>}
        />
      ) : (
        <div className="card p-0 overflow-auto">
          <table className="campaigns-table">
            <thead><tr><th>Ad form</th><th>Leads</th><th>Contacted</th><th>Clients</th><th>Cost/lead</th><th>Cost/client</th><th>Client payments</th><th>Collected / owed</th><th></th></tr></thead>
            <tbody>
              {rows.map(({ src, st }) => {
                const s = info?.status?.[src.id];
                const paused = src.active === false;
                return (
                  <tr key={src.id} style={paused ? { opacity: 0.7 } : undefined}>
                    <td className="font-medium" style={{ minWidth: 230 }}>
                      <button className="underline decoration-[var(--line)] text-left" onClick={() => setOpenId(src.id)}>{src.name}</button>
                      <div className="mt-0.5 text-[11.5px] text-[var(--muted)]">{src.country || 'Country from the sheet'} · {src.campaign || 'Campaign from the sheet'}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {paused && <Pill text="Paused" tone="grey" />}
                        {!paused && !s && <Pill text="Not synced yet" tone="gold" />}
                        {!paused && s && s.ok && <Pill text="Working" tone="green" />}
                        {!paused && s && !s.ok && <Pill text="Problem" tone="red" />}
                        {s && <span className="text-[11px] text-[var(--faint)]">{s.ok ? `checked ${ago(s.at)} · ${s.rows} rows in sheet` : `tried ${ago(s.at)}`}</span>}
                      </div>
                      {s && !s.ok && s.error && <div className="text-[11.5px] mt-1" style={{ color: 'var(--red)', maxWidth: 360 }}>{s.error}</div>}
                    </td>
                    <td className="font-mono-ui text-xs">{st.leads}{st.waiting > 0 && <div className="text-[10.5px]" style={{ color: 'var(--gold)' }}>{st.waiting} waiting</div>}</td>
                    <td className="font-mono-ui text-xs">{st.contacted}<div className="text-[10.5px] text-[var(--muted)]">{pctText(st.contactedPct)}</div></td>
                    <td className="font-mono-ui text-xs">{st.converted}<div className="text-[10.5px] text-[var(--muted)]">{pctText(st.convertedPct)}</div></td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{st.cpl ? money(st.cpl) : '—'}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{st.cpc ? money(st.cpc) : '—'}</td>
                    <td className="text-[11.5px]" style={{ minWidth: 120 }}>
                      {st.converted === 0 ? <span className="text-[var(--faint)]">no clients yet</span> : (
                        <>
                          <div style={{ color: 'var(--green)' }}>{st.full} paid in full</div>
                          <div style={{ color: '#8a5a12' }}>{st.part} part paid</div>
                          <div style={{ color: st.unpaid ? 'var(--red)' : 'var(--faint)' }}>{st.unpaid} unpaid</div>
                        </>
                      )}
                    </td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{money(st.revenue)}{st.outstanding > 0 && <div className="text-[10.5px]" style={{ color: 'var(--gold)' }}>{money(st.outstanding)} owed</div>}</td>
                    <td>
                      <div className="flex gap-1.5 justify-end whitespace-nowrap">
                        <button className="btn btn-sm" disabled={!!busy || paused} onClick={() => runSync(src.id)}>{busy === src.id ? 'Syncing…' : 'Sync'}</button>
                        <button className="btn btn-sm btn-primary" onClick={() => setOpenId(src.id)}>Open</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(src)}>Edit</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {unlinked.leads > 0 && rows.length > 0 && (
        <div className="text-[12px] text-[var(--muted)] mt-2">
          {unlinked.leads} other lead{unlinked.leads === 1 ? '' : 's'} did not come through any of these forms (typed in by staff, imported earlier, or from the website) and are not counted above.
        </div>
      )}

      {byCountry.length > 0 && (
        <>
          <SectionHead title="Country by country" count="all forms of a country added together" />
          <div className="card p-0 overflow-auto">
            <table>
              <thead><tr><th>Country</th><th>Forms</th><th>Leads</th><th>Contacted</th><th>Clients</th><th>Conversion</th><th>Ad spend</th><th>Cost/client</th><th>Collected</th><th>Still owed</th></tr></thead>
              <tbody>
                {byCountry.map(c => (
                  <tr key={c.country}>
                    <td className="font-medium">{c.country}</td>
                    <td className="font-mono-ui text-xs">{c.sources}</td>
                    <td className="font-mono-ui text-xs">{c.leads}</td>
                    <td className="font-mono-ui text-xs">{c.leads ? pctText(Math.round((c.contacted / c.leads) * 1000) / 10) : '—'}</td>
                    <td className="font-mono-ui text-xs">{c.converted}</td>
                    <td className="font-mono-ui text-xs">{c.leads ? pctText(Math.round((c.converted / c.leads) * 1000) / 10) : '—'}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{c.spend ? money(c.spend) : '—'}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{c.converted && c.spend ? money(c.spend / c.converted) : '—'}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{money(c.revenue)}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap" style={c.outstanding ? { color: 'var(--gold)' } : undefined}>{c.outstanding ? money(c.outstanding) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <SourceForm
            key={editing === 'new' ? 'new' : editing.id}
            source={editing === 'new' ? null : editing}
            existing={leadSources}
            campaignNames={campaigns.map(c => c.name)}
            onClose={() => setEditing(null)}
            onSave={(src, syncAfter) => {
              setLeadSources(prev => prev.some(x => x.id === src.id) ? prev.map(x => (x.id === src.id ? src : x)) : [...prev, src]);
              setEditing(null);
              toast(syncAfter ? 'Saved — bringing in the leads…' : 'Saved');
              if (syncAfter) { setTimeout(() => { runSync(src.id).then(ok => { if (ok) setOpenId(src.id); }); }, 500); }
            }}
            onDelete={src => {
              setLeadSources(prev => prev.filter(x => x.id !== src.id));
              setEditing(null);
              toast('Lead source removed — its leads stay in the portal');
            }}
          />
        )}
      </Modal>

      <Modal open={!!open} onClose={() => setOpenId(null)} wide>
        {open && (
          <SourceDetail
            source={open}
            stats={rows.find(r => r.src.id === open.id)?.st || sourceStats(open, leads, campaigns, cases, leadSources)}
            status={info?.status?.[open.id]}
            busy={busy === open.id}
            onSync={() => runSync(open.id)}
            onEdit={() => { setOpenId(null); setEditing(open); }}
            onClose={() => setOpenId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function SourceForm({ source, existing, campaignNames, onSave, onDelete, onClose }: {
  source: LeadSource | null; existing: LeadSource[]; campaignNames: string[];
  onSave: (s: LeadSource, syncAfter: boolean) => void; onDelete: (s: LeadSource) => void; onClose: () => void;
}) {
  const [name, setName] = useState(source?.name || '');
  const [country, setCountry] = useState(source?.country || '');
  const [campaign, setCampaign] = useState(source?.campaign || '');
  const [url, setUrl] = useState(source?.url || '');
  const [sinceDays, setSinceDays] = useState(source ? source.sinceDays : 30);
  const [active, setActive] = useState(source ? source.active !== false : true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function build(): LeadSource | null {
    if (!name.trim()) { setError('Give this form a name, for example “UK visitor visa form”.'); return null; }
    const link = url.trim();
    if (!link) { setError('Paste the Google Sheet link for this form.'); return null; }
    const conv = sheetCsvUrl(link);
    if (!conv.url) { setError(conv.error || 'That link cannot be used.'); return null; }
    const twin = existing.find(s => s.id !== source?.id && sheetCsvUrl(s.url).url === conv.url);
    if (twin) { setError(`That sheet is already used by “${twin.name}”. Each form needs its own link.`); return null; }
    setError('');
    return {
      id: source?.id || genId('ls'), name: name.trim(), country, campaign: campaign.trim(), url: link, active, sinceDays,
      createdAt: source?.createdAt || today(),
    };
  }

  return (
    <>
      <ModalTitle>{source ? 'Edit lead source' : 'New lead source'}</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3 leading-relaxed">
        One link for one ad form. In Facebook, open the form’s leads sheet in Google Sheets, press <b>Share → General access → Anyone with the link → Viewer</b>, and copy the address from the browser while the right tab is open.
      </div>
      <Field label="Name of this form"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. UK visitor visa form" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Country its leads belong to">
          <select value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">Take it from the sheet</option>
            {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <input list="leadsource-campaigns" value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="Leave empty to use the sheet’s own" />
          <datalist id="leadsource-campaigns">{campaignNames.map(n => <option key={n} value={n} />)}</datalist>
        </Field>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1.5 mb-3">Every lead of this form is filed under the country you choose. If the form lets people pick different countries, choose “Take it from the sheet”. A campaign name the portal has not seen before is created for you in Campaigns, ready for a budget and payments.</div>
      <Field label="Google Sheet link">
        <textarea rows={2} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit?gid=…" style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: 12 }} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First time, bring in">
          <select value={sinceDays} onChange={e => setSinceDays(Number(e.target.value))}>
            {SINCE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <label className="flex items-center gap-2 text-[13px]" style={{ margin: 0, paddingTop: 8 }}>
            <input type="checkbox" className="!w-auto" checked={active} onChange={e => setActive(e.target.checked)} />
            Active (untick to pause this form)
          </label>
        </Field>
      </div>
      {error && <div className="card mb-3" style={{ background: 'var(--red-50)' }}><div className="text-[13px]" style={{ color: 'var(--red)' }}>{error}</div></div>}
      {source && (
        <div className="mb-3">
          {!confirmDelete
            ? <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmDelete(true)}>Remove this lead source</button>
            : (
              <div className="card" style={{ background: 'var(--red-50)' }}>
                <div className="text-[12.5px]">Remove “{source.name}”? Its leads stay in the portal; only the link and the form’s numbers go.</div>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(source)}>Yes, remove it</button>
                  <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Keep it</button>
                </div>
              </div>
            )}
        </div>
      )}
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => { const s = build(); if (s) onSave(s, false); }}>Save</button>
        <button className="btn btn-primary" onClick={() => { const s = build(); if (s) onSave(s, true); }}>Save &amp; bring in leads</button>
      </ModalFoot>
    </>
  );
}

function SourceDetail({ source, stats, status, busy, onSync, onEdit, onClose }: {
  source: LeadSource; stats: SourceStats; status?: SourceStatus; busy: boolean; onSync: () => void; onEdit: () => void; onClose: () => void;
}) {
  const { leads, cases } = useAppData();
  const mine = useMemo(() => leads.filter(l => l.sourceId === source.id && l.stage === 'Converted'), [leads, source.id]);
  const clients = useMemo(() => mine.map(l => ({ lead: l, pay: leadPayment(l, cases) })).sort((a, b) => b.pay.outstanding - a.pay.outstanding), [mine, cases]);

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="font-display text-[17px] font-semibold m-0">{source.name}</h3>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">{source.country || 'Country from the sheet'} · {source.campaign || 'Campaign from the sheet'}{source.active === false ? ' · paused' : ''}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={onSync} disabled={busy || source.active === false}>{busy ? 'Syncing…' : 'Sync now'}</button>
          <button className="btn btn-sm" onClick={onEdit}>Edit</button>
        </div>
      </div>

      {status && !status.ok && <div className="card mb-3" style={{ background: 'var(--red-50)' }}><div className="text-[13px]" style={{ color: 'var(--red)' }}>{status.error}</div></div>}
      {status && status.ok && <div className="text-[11.5px] text-[var(--muted)] mb-3">Last checked {ago(status.at)} · {status.rows} rows in the sheet · {status.totalImported} leads brought in so far.</div>}

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Tile label="Leads" value={String(stats.leads)} sub={`${stats.waiting} not contacted yet`} />
        <Tile label="Contacted" value={pctText(stats.contactedPct)} sub={`${stats.contacted} of ${stats.leads}`} />
        <Tile label="Qualified" value={pctText(stats.qualifiedPct)} sub={`${stats.qualified} of ${stats.leads}`} />
        <Tile label="Became clients" value={pctText(stats.convertedPct)} sub={`${stats.converted} client${stats.converted === 1 ? '' : 's'} · ${stats.lost} lost`} color="var(--green)" />
      </div>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Tile label="Ad spend (its share)" value={stats.spend ? money(stats.spend) : '—'} sub={stats.campaign ? `campaign ${stats.campaign}` : 'no campaign set'} />
        <Tile label="Cost per lead" value={stats.cpl ? money(stats.cpl) : '—'} />
        <Tile label="Cost per client" value={stats.cpc ? money(stats.cpc) : '—'} />
        <Tile label="Collected" value={money(stats.revenue)} sub={stats.outstanding > 0 ? `${money(stats.outstanding)} still owed` : 'nothing owed'} color="var(--green)" />
      </div>

      <h4 className="font-display text-[14px] font-semibold mt-5 mb-2">What people answered</h4>
      {!stats.questions.length ? (
        <div className="text-[12.5px] text-[var(--muted)] mb-3">No answers saved yet. Answers are kept for every lead this form brings in — press Sync now to bring them in.</div>
      ) : stats.questions.map(q => (
        <div key={q.question} className="card p-0 overflow-auto mb-3">
          <table>
            <thead><tr><th>{q.question}</th><th style={{ width: 70 }}>Leads</th><th style={{ width: 70 }}>Clients</th><th style={{ width: 190 }}>Became clients</th></tr></thead>
            <tbody>
              {q.answers.slice(0, 12).map(a => (
                <tr key={a.answer}>
                  <td className="text-[12.5px]">{a.answer}</td>
                  <td className="font-mono-ui text-xs">{a.leads}</td>
                  <td className="font-mono-ui text-xs">{a.converted}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, height: 6, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, a.pct)}%`, height: '100%', background: 'var(--green)' }} />
                      </div>
                      <span className="font-mono-ui text-xs" style={{ minWidth: 42, textAlign: 'right' }}>{pctText(a.pct)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {q.answers.length > 12 && <tr><td colSpan={4} className="text-[11.5px] text-[var(--muted)]">+ {q.answers.length - 12} more answers</td></tr>}
            </tbody>
          </table>
        </div>
      ))}

      <h4 className="font-display text-[14px] font-semibold mt-5 mb-2">Clients from this form</h4>
      {!clients.length ? (
        <div className="text-[12.5px] text-[var(--muted)] mb-3">No lead from this form has been converted yet.</div>
      ) : (
        <div className="card p-0 overflow-auto mb-3">
          <table>
            <thead><tr><th>Client</th><th>Payment</th><th>Charge</th><th>Paid</th><th>Still owed</th></tr></thead>
            <tbody>
              {clients.slice(0, 25).map(({ lead, pay }) => (
                <tr key={lead.id}>
                  <td className="font-medium">{lead.name}</td>
                  <td><Pill text={pay.state} tone={pay.state === 'Paid in full' ? 'green' : pay.state === 'Part paid' ? 'gold' : pay.state === 'Unpaid' ? 'red' : 'grey'} /></td>
                  <td className="font-mono-ui text-xs">{pay.charge ? money(pay.charge) : '—'}</td>
                  <td className="font-mono-ui text-xs">{pay.paid ? money(pay.paid) : '—'}</td>
                  <td className="font-mono-ui text-xs" style={pay.outstanding ? { color: 'var(--gold)' } : undefined}>{pay.outstanding ? money(pay.outstanding) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ModalFoot><button className="btn" onClick={onClose}>Close</button></ModalFoot>
    </>
  );
}
