'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import { leadPayment } from '@/lib/leadStats';
import { matchesCampaignName, lastRateAndTax } from '@/lib/campaigns';
import { WINDOWS, WINDOW_LABELS, type MetaWindow, type MetaAccount, type MetaCampaign, type MetaSnapshot, type MetaPublicConfig } from '@/lib/metaTypes';
import type { Lead } from '@/lib/types';

// Ads Manager: reads your Meta ad account (read-only) and sets each campaign
// beside what the portal knows — the leads it produced, their stage, the
// clients and what they have paid.

const STAGES: Lead['stage'][] = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
const EVERY: [number, string][] = [[15, 'every 15 minutes'], [30, 'every 30 minutes'], [60, 'every hour'], [360, 'every 6 hours'], [1440, 'once a day']];

function ago(iso?: string): string {
  if (!iso) return '';
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}
const cur = (n: number, currency: string) => (currency === 'USD' ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : currency === 'PKR' ? money(n) : `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`);

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
function metaStatus(s: string): { text: string; tone: 'green' | 'gold' | 'red' | 'grey' } {
  switch (s) {
    case 'ACTIVE': return { text: 'Running', tone: 'green' };
    case 'PAUSED': return { text: 'Paused', tone: 'gold' };
    case 'ARCHIVED': return { text: 'Archived', tone: 'grey' };
    case 'WITH_ISSUES': return { text: 'Has issues', tone: 'red' };
    case 'IN_PROCESS': return { text: 'Being reviewed', tone: 'gold' };
    case 'NOT LISTED': return { text: 'Deleted', tone: 'grey' };
    default: return { text: s || 'Unknown', tone: 'grey' };
  }
}

export function AdsManager() {
  const { session, team } = useAppData();
  const admin = session?.type === 'ceo' || (session?.type === 'employee' && !!team.find(t => t.id === session.staffId)?.isAdmin);
  if (!admin) return <EmptyState title="Ads Manager is for the Head Manager" body="It holds the connection to your ad account, so only the Head Manager and admins can open it." />;
  return <AdsManagerInner />;
}

function AdsManagerInner() {
  const { leads, cases, campaigns, setCampaigns } = useAppData();
  const toast = useToast();
  const [cfg, setCfg] = useState<MetaPublicConfig | null>(null);
  const [account, setAccount] = useState<MetaAccount | null>(null);
  const [snap, setSnap] = useState<MetaSnapshot | null>(null);
  const [win, setWin] = useState<MetaWindow>('last_30d');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const refreshNow = useCallback(async (w: MetaWindow) => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/meta-ads/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ window: w }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Something went wrong reading Meta.'); return false; }
      setSnap(data.snapshot); setAccount(data.account);
      return true;
    } catch { setError('Could not reach the server.'); return false; }
    finally { setBusy(false); }
  }, []);

  const load = useCallback(async (w: MetaWindow) => {
    try {
      const res = await fetch(`/api/meta-ads?window=${w}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not load.'); setLoaded(true); return; }
      setCfg(data.config); setAccount(data.account); setSnap(data.snapshot);
      if (data.config.lastError) setError(data.config.lastError);
      setLoaded(true);
      // First time for this period: read it now rather than show an empty page.
      if (data.config.connected && !data.snapshot && !data.config.lastError) refreshNow(w);
    } catch { setError('Could not reach the server.'); setLoaded(true); }
  }, [refreshNow]);
  useEffect(() => { load(win); }, [win, load]);

  // ------------------------------------------------------------- the numbers
  const logged = useMemo(() => lastRateAndTax(campaigns), [campaigns]);
  const rate = cfg?.usdRate || logged?.rate || 0;
  const tax = cfg?.usdRate ? cfg.taxPct : logged?.taxPct || 0;
  const currency = snap?.currency || account?.currency || '';
  const toPkr = useCallback((n: number): number | null => {
    if (currency === 'PKR') return n;
    if (currency === 'USD' && rate > 0) return Math.round(n * rate * (1 + tax / 100));
    return null;
  }, [currency, rate, tax]);

  const inWindow = useCallback((d: string) => !snap || snap.window === 'maximum' || (!!d && d >= snap.since && d <= snap.until), [snap]);

  const rows = useMemo(() => (snap?.campaigns || []).map((m: MetaCampaign) => {
    const linked = campaigns.find(cp => matchesCampaignName(cp, m.name));
    const mine = linked ? leads.filter(l => matchesCampaignName(linked, l.campaign) && inWindow(l.createdAt)) : [];
    const stages = Object.fromEntries(STAGES.map(s => [s, mine.filter(l => l.stage === s).length])) as Record<Lead['stage'], number>;
    const clients = mine.filter(l => l.stage === 'Converted').map(l => leadPayment(l, cases));
    const collected = clients.reduce((n, p) => n + p.paid, 0);
    const owed = clients.reduce((n, p) => n + p.outstanding, 0);
    const pkr = toPkr(m.spend);
    return {
      m, linked, byName: !!linked && linked.name.trim().toLowerCase() === m.name.trim().toLowerCase(), portalLeads: mine.length, stages,
      full: clients.filter(p => p.state === 'Paid in full').length, part: clients.filter(p => p.state === 'Part paid').length, unpaid: clients.filter(p => p.state === 'Unpaid').length,
      collected, owed, pkr, ret: pkr && pkr > 0 ? collected / pkr : 0,
    };
  }), [snap, campaigns, leads, cases, inWindow, toPkr]);

  const tot = useMemo(() => rows.reduce((t, r) => ({
    spend: t.spend + r.m.spend, metaLeads: t.metaLeads + r.m.leads, portalLeads: t.portalLeads + r.portalLeads,
    clients: t.clients + r.stages.Converted, collected: t.collected + r.collected, owed: t.owed + r.owed, pkr: t.pkr + (r.pkr || 0),
  }), { spend: 0, metaLeads: 0, portalLeads: 0, clients: 0, collected: 0, owed: 0, pkr: 0 }), [rows]);

  const unlinkedPortal = useMemo(() => {
    if (!snap) return [] as { name: string; leads: number }[];
    return campaigns
      .filter(cp => !snap.campaigns.some(m => matchesCampaignName(cp, m.name)))
      .map(cp => ({ name: cp.name, leads: leads.filter(l => matchesCampaignName(cp, l.campaign) && inWindow(l.createdAt)).length }))
      .filter(x => x.leads > 0);
  }, [snap, campaigns, leads, inWindow]);

  function link(metaName: string, campaignId: string) {
    setCampaigns(prev => prev.map(cp => {
      if (cp.id === campaignId) return { ...cp, fbName: metaName };
      if ((cp.fbName || '').trim().toLowerCase() === metaName.trim().toLowerCase()) return { ...cp, fbName: '' };
      return cp;
    }));
    toast('Linked — the leads of that campaign now show beside the Meta figures');
  }
  function unlink(campaignId: string) { setCampaigns(prev => prev.map(cp => (cp.id === campaignId ? { ...cp, fbName: '' } : cp))); }

  // ------------------------------------------------------------- screens
  if (!loaded) return <div className="text-[13px] text-[var(--muted)]">Loading…</div>;

  if (!cfg?.connected || !account) {
    return <ConnectForm cfg={cfg} error={cfg?.connected ? error : ''} onDone={async () => { await load(win); }} />;
  }

  const spendPkrKnown = tot.pkr > 0;
  return (
    <div>
      <SectionHead title={account.name || 'Ads Manager'} count={`${account.currency} · account ${account.statusText.toLowerCase()} · ${snap ? `read ${ago(snap.fetchedAt)}` : 'not read yet'}`} action={
        <div className="flex gap-2 ml-auto items-center flex-wrap">
          <select style={{ width: 'auto' }} value={win} onChange={e => { setSnap(null); setWin(e.target.value as MetaWindow); }}>
            {WINDOWS.map(w => <option key={w} value={w}>{WINDOW_LABELS[w]}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => refreshNow(win)} disabled={busy}>{busy ? 'Reading Meta…' : 'Refresh now'}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      } />

      {error && (
        <div className="card mb-4" style={{ background: 'var(--red-50)' }}>
          <div className="text-[13px]" style={{ color: 'var(--red)' }}>{error}</div>
          <div className="mt-2"><button className="btn btn-sm" onClick={() => setShowSettings(true)}>Open settings</button></div>
        </div>
      )}
      {account.status !== 1 && account.status !== 201 && (
        <div className="card mb-4" style={{ background: 'var(--gold-50)' }}><div className="text-[13px]"><b>Meta reports this ad account as “{account.statusText}”.</b> Ads may not be delivering — open Ads Manager to see why.</div></div>
      )}

      {snap && (
        <>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Tile label={`Meta spend — ${WINDOW_LABELS[snap.window].toLowerCase()}`} value={cur(tot.spend, currency)} sub={spendPkrKnown && currency !== 'PKR' ? `about ${money(tot.pkr)} in rupees at ${rate} + ${tax}% tax` : currency !== 'PKR' && !rate ? 'set the dollar rate in Settings for rupee figures' : undefined} />
            <Tile label="Leads Meta counted" value={String(tot.metaLeads)} sub={tot.metaLeads ? `${cur(tot.spend / tot.metaLeads, currency)} each according to Meta` : undefined} />
            <Tile label="Leads in the portal" value={String(tot.portalLeads)} sub={tot.metaLeads > tot.portalLeads ? `${tot.metaLeads - tot.portalLeads} fewer than Meta counted` : 'from the linked campaigns'} color={tot.metaLeads > tot.portalLeads ? 'var(--gold)' : undefined} />
            <Tile label="Clients · collected" value={`${tot.clients} · ${money(tot.collected)}`} sub={tot.owed > 0 ? `${money(tot.owed)} still owed` : 'nothing owed'} color="var(--green)" />
            <Tile label="Return on ad spend" value={spendPkrKnown && tot.collected > 0 ? `${(tot.collected / tot.pkr).toFixed(1)}×` : '—'} sub="collected ÷ spend, same period" />
          </div>

          {!snap.campaigns.length ? (
            <EmptyState title="No campaigns in this period" body="Meta returned no campaigns or spend for the period you chose. Try a longer period." />
          ) : (
            <div className="card p-0 overflow-auto">
              <table className="campaigns-table">
                <thead><tr><th>Campaign in Ads Manager</th><th>Spend</th><th>Leads: Meta / portal</th><th>Lead status in the portal</th><th>Client payments</th><th>Collected / owed</th><th>Return</th></tr></thead>
                <tbody>
                  {rows.map(r => {
                    const st = metaStatus(r.m.status);
                    return (
                      <tr key={r.m.id} style={r.m.status === 'ARCHIVED' || r.m.status === 'NOT LISTED' ? { opacity: 0.75 } : undefined}>
                        <td className="font-medium" style={{ minWidth: 240 }}>
                          {r.m.name}
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap"><Pill text={st.text} tone={st.tone} />{r.m.startTime && <span className="text-[11px] text-[var(--faint)]">since {r.m.startTime}</span>}</div>
                          <div className="mt-1.5 text-[11.5px] font-normal">
                            {r.linked ? (
                              <span className="text-[var(--muted)]">↔ Portal campaign: <b>{r.linked.name}</b>{!r.byName && <> · <button className="underline" onClick={() => unlink(r.linked!.id)}>unlink</button></>}</span>
                            ) : (
                              <select style={{ width: 'auto', maxWidth: 230, fontSize: 12 }} value="" onChange={e => { if (e.target.value) link(r.m.name, e.target.value); }}>
                                <option value="">Link to a portal campaign…</option>
                                {campaigns.map(cp => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="font-mono-ui text-xs whitespace-nowrap">{cur(r.m.spend, currency)}{r.pkr !== null && currency !== 'PKR' && <div className="text-[10.5px] text-[var(--muted)]">≈ {money(r.pkr)}</div>}<div className="text-[10.5px] text-[var(--faint)]">{r.m.clicks.toLocaleString()} clicks · {r.m.reach.toLocaleString()} reached</div></td>
                        <td className="font-mono-ui text-xs whitespace-nowrap">
                          {r.m.leads} / {r.linked ? r.portalLeads : '—'}
                          {r.m.leads > 0 && <div className="text-[10.5px] text-[var(--muted)]">{cur(r.m.spend / r.m.leads, currency)} per lead</div>}
                          {r.linked && r.m.leads > r.portalLeads && <div className="text-[10.5px]" style={{ color: 'var(--gold)', maxWidth: 190, whiteSpace: 'normal' }}>Meta counted {r.m.leads - r.portalLeads} more — check Lead Sources</div>}
                          {!r.linked && r.m.leads > 0 && <div className="text-[10.5px]" style={{ color: 'var(--gold)', maxWidth: 190, whiteSpace: 'normal' }}>not linked — portal leads not shown</div>}
                        </td>
                        <td className="text-[11.5px]" style={{ minWidth: 150 }}>
                          {!r.linked || !r.portalLeads ? <span className="text-[var(--faint)]">—</span> : (
                            <>
                              <div>{r.stages.New} new · {r.stages.Contacted} contacted</div>
                              <div>{r.stages.Qualified} qualified</div>
                              <div style={{ color: 'var(--green)' }}>{r.stages.Converted} converted</div>
                              <div style={{ color: r.stages.Lost ? 'var(--red)' : 'var(--faint)' }}>{r.stages.Lost} lost</div>
                            </>
                          )}
                        </td>
                        <td className="text-[11.5px]" style={{ minWidth: 110 }}>
                          {!r.stages.Converted ? <span className="text-[var(--faint)]">no clients yet</span> : (
                            <>
                              <div style={{ color: 'var(--green)' }}>{r.full} paid in full</div>
                              <div style={{ color: '#8a5a12' }}>{r.part} part paid</div>
                              <div style={{ color: r.unpaid ? 'var(--red)' : 'var(--faint)' }}>{r.unpaid} unpaid</div>
                            </>
                          )}
                        </td>
                        <td className="font-mono-ui text-xs whitespace-nowrap">{money(r.collected)}{r.owed > 0 && <div className="text-[10.5px]" style={{ color: 'var(--gold)' }}>{money(r.owed)} owed</div>}</td>
                        <td className="font-mono-ui text-xs">{r.ret > 0 ? `${r.ret.toFixed(1)}×` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {unlinkedPortal.length > 0 && (
            <div className="text-[12px] text-[var(--muted)] mt-3 leading-relaxed">
              Portal campaigns with leads in this period that Ads Manager does not show: {unlinkedPortal.map(x => `${x.name} (${x.leads})`).join(', ')}. They may be named differently in Meta — link them from the Meta campaign’s row above.
            </div>
          )}
          <div className="text-[11.5px] text-[var(--faint)] mt-3 leading-relaxed">
            Meta’s figures are read-only and come from Meta’s own reports in the account’s time zone ({account.timezone || 'account time'}), so they can differ a little from the portal. Leads reach the portal through Lead Sources; payments come from the Cases of the clients those leads became. {cfg.auto ? `The portal re-reads Meta ${EVERY.find(e => e[0] === cfg.everyMinutes)?.[1] || 'regularly'}.` : 'Automatic reading is off.'}
          </div>
        </>
      )}

      <Modal open={showSettings} onClose={() => setShowSettings(false)}>
        {showSettings && <SettingsForm cfg={cfg} onClose={() => setShowSettings(false)} onSaved={async () => { setShowSettings(false); setError(''); await load(win); await refreshNow(win); }} />}
      </Modal>
    </div>
  );
}

const STEPS = (
  <ol className="m-0 pl-5 text-[13px] leading-[1.7] grid gap-1.5">
    <li>Open <b>business.facebook.com → Business settings</b> (the same business that owns your ad account).</li>
    <li>Go to <b>Users → System users</b> and press <b>Add</b>. Name it “GoGlobe portal”, role <b>Employee</b>.</li>
    <li>Select that system user, press <b>Add assets</b>, choose <b>Ad accounts</b>, pick your ad account and give it <b>View performance</b> only. It cannot change or spend anything.</li>
    <li>Press <b>Generate token</b>, choose your app (if you have none, create a “Business” app at developers.facebook.com first), tick only <b>ads_read</b>, and copy the token. Meta shows it once.</li>
    <li>Your <b>ad account ID</b> is the number beside the account name in Ads Manager (also <span className="font-mono-ui">act=…</span> in the address).</li>
  </ol>
);

function ConnectForm({ cfg, error, onDone }: { cfg: MetaPublicConfig | null; error: string; onDone: () => void }) {
  const [accountId, setAccountId] = useState(cfg?.accountId || '');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState(error);
  const [busy, setBusy] = useState(false);
  async function connect() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/meta-ads', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, ...(token.trim() ? { token } : {}) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(data.error || 'Could not save.'); return; }
      if (data.test && !data.test.ok) { setMsg(data.test.error); return; }
      setToken('');
      await onDone();
    } catch { setMsg('Could not reach the server.'); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ maxWidth: 760 }}>
      <SectionHead title="Connect Ads Manager" count="read-only — it can never change or spend anything" />
      <div className="card mb-4">
        <div className="text-[13px] mb-3 leading-relaxed">Once connected, this page shows every campaign in your ad account — whether it is running, what it spent, how many leads Meta counted — next to the leads, clients and payments the portal holds for it.</div>
        {STEPS}
      </div>
      <div className="card">
        <Field label="Ad account ID"><input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="e.g. 1234567890123456" autoComplete="off" /></Field>
        <Field label="Access token (stays on the server, never shown again)"><input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder={cfg?.tokenSet ? `Saved (${cfg.tokenHint}) — paste a new one to replace it` : 'Paste the token here'} autoComplete="off" /></Field>
        {msg && <div className="card mb-3" style={{ background: 'var(--red-50)' }}><div className="text-[13px]" style={{ color: 'var(--red)' }}>{msg}</div></div>}
        <button className="btn btn-primary" onClick={connect} disabled={busy || !accountId.trim() || (!token.trim() && !cfg?.tokenSet)}>{busy ? 'Connecting…' : 'Save & connect'}</button>
        <div className="text-[11.5px] text-[var(--faint)] mt-2">The token is stored on your server only. You can also keep it in your hosting settings as META_ADS_TOKEN and META_AD_ACCOUNT_ID.</div>
      </div>
    </div>
  );
}

function SettingsForm({ cfg, onClose, onSaved }: { cfg: MetaPublicConfig | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [accountId, setAccountId] = useState(cfg?.accountId || '');
  const [token, setToken] = useState('');
  const [usdRate, setUsdRate] = useState(cfg?.usdRate ? String(cfg.usdRate) : '');
  const [taxPct, setTaxPct] = useState(cfg?.taxPct ? String(cfg.taxPct) : '');
  const [auto, setAuto] = useState(cfg?.auto !== false);
  const [every, setEvery] = useState(cfg?.everyMinutes || 60);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  async function put(body: Record<string, unknown>) {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/meta-ads', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || 'Could not save.'); return null; }
      if (data.test && !data.test.ok) { setErr(data.test.error); return null; }
      return data;
    } catch { setErr('Could not reach the server.'); return null; }
    finally { setBusy(false); }
  }
  async function save() {
    const body: Record<string, unknown> = { accountId, usdRate: Number(usdRate || 0), taxPct: Number(taxPct || 0), auto, everyMinutes: every };
    if (token.trim()) body.token = token;
    const d = await put(body);
    if (d) { toast('Saved'); onSaved(); }
  }
  async function disconnect() {
    const d = await put({ disconnect: true });
    if (d) { toast('Disconnected — the token and the saved figures were removed'); onSaved(); }
  }
  return (
    <>
      <ModalTitle>Ads Manager settings</ModalTitle>
      <Field label="Ad account ID"><input value={accountId} onChange={e => setAccountId(e.target.value)} disabled={cfg?.accountFromHosting} /></Field>
      <Field label="Access token"><input type="password" value={token} onChange={e => setToken(e.target.value)} disabled={cfg?.tokenFromHosting} autoComplete="off" placeholder={cfg?.tokenFromHosting ? 'Set in your hosting settings' : cfg?.tokenSet ? `Saved (${cfg.tokenHint}) — leave empty to keep it` : 'Paste the token'} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dollar rate (rupees per $1)"><input inputMode="decimal" value={usdRate} onChange={e => setUsdRate(e.target.value)} placeholder="empty = last rate you logged" /></Field>
        <Field label="Tax / bank charges on top (%)"><input inputMode="decimal" value={taxPct} onChange={e => setTaxPct(e.target.value)} placeholder="e.g. 5" /></Field>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1.5 mb-3">Meta bills in the account’s currency. These two give the rupee estimate beside each figure; your real payments stay in Campaigns.</div>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="flex items-center gap-2 text-[13px]" style={{ margin: 0 }}><input type="checkbox" className="!w-auto" checked={auto} onChange={e => setAuto(e.target.checked)} />Read Meta automatically</label>
        <select style={{ width: 'auto' }} value={every} onChange={e => setEvery(Number(e.target.value))}>{EVERY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <details className="mb-3"><summary className="text-[12.5px] cursor-pointer text-[var(--muted)]">How to make a token</summary><div className="mt-2">{STEPS}</div></details>
      {err && <div className="card mb-3" style={{ background: 'var(--red-50)' }}><div className="text-[13px]" style={{ color: 'var(--red)' }}>{err}</div></div>}
      {!confirmOff
        ? <div className="mb-3"><button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirmOff(true)}>Disconnect Ads Manager</button></div>
        : (
          <div className="card mb-3" style={{ background: 'var(--red-50)' }}>
            <div className="text-[12.5px]">Disconnect? The saved token and the figures read from Meta are deleted. Your leads and campaigns stay.</div>
            <div className="flex gap-2 mt-2"><button className="btn btn-sm btn-danger" onClick={disconnect} disabled={busy}>Yes, disconnect</button><button className="btn btn-sm" onClick={() => setConfirmOff(false)}>Keep it</button></div>
          </div>
        )}
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </ModalFoot>
    </>
  );
}
