'use client';
import { useCallback, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { genId, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, EmptyState } from '@/components/ui/Primitives';
import { StatCard, Panel, Callout } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { SLOT_COUNTRIES, isWaiting, pktDate, pktToMs, countryMatches, PRIORITY_COUNTRIES } from '@/lib/slotdesk';
import {
  ALERT_CATEGORIES, CATEGORY_INFO, SOURCE_CHOICES, agoLabel, claimOf, configFor, fmtOpens, fmtPkt, ingest, nextAction, sortAlerts,
  sourceHealth, systemAlerts, upcomingOfficial, type SourceHealth,
} from '@/lib/slotalerts';
import { ADAPTERS, FIVE_COUNTRIES, PROVIDER_TABLE, adapterFor, providerRow } from '@/lib/slotproviders';
import {
  ALERT_COLUMNS, AUDIT_COLUMNS, NOTICE_COLUMNS, RETENTION_CHOICES, alertsReport, auditReport, cutoffIso, downloadCsv, filterAudit, makeAudit,
  noticesReport, oldAuditEntries, oldFinishedCases, trimAudit, casesReport, CASE_COLUMNS,
} from '@/lib/slotreport';
import type { AlertCategory, AlertVerification, SlotAlert, SlotAudit, SlotConfig, SlotRelease } from '@/lib/types';

export type SlotTab = 'overview' | 'waiting' | 'standby' | 'live' | 'alerts' | 'releases' | 'guide' | 'providers' | 'results' | 'cost' | 'audit';

export const TONE = {
  good: { background: '#EAF6EF', color: '#0B6E4F' },
  info: { background: '#EAF2FC', color: '#1D5FA8' },
  warn: { background: '#FFF6E0', color: '#8A5A00' },
  bad: { background: '#FDECEC', color: '#B42318' },
  neutral: { background: '#F1F1F1', color: '#555' },
} as const;

/** The name that goes on everything this person does: the Head Manager, or the team member. */
export function useWho(): string {
  const { session, team } = useAppData();
  return session?.type === 'ceo' ? 'Head Manager' : team.find(t => t.id === (session && session.type === 'employee' ? session.staffId : ''))?.name || '';
}

/** Writes one line to the audit trail: who, what, which country, about whom. No phone or passport details, ever. */
export function useAudit() {
  const { setSlotAudit } = useAppData();
  const who = useWho();
  return useCallback((area: SlotAudit['area'], action: string, o: { country?: string; ref?: string; detail?: string } = {}) => {
    setSlotAudit(prev => trimAudit([...prev, makeAudit(who, area, action, o, genId('au'), new Date().toISOString())]));
  }, [who, setSlotAudit]);
}

export function upsertConfig(list: SlotConfig[], cfg: SlotConfig): SlotConfig[] {
  return list.some(c => c.country === cfg.country) ? list.map(c => (c.country === cfg.country ? cfg : c)) : [...list, cfg];
}

/** "I have looked at this country's official notices page now." */
export function useMarkChecked() {
  const { slotConfig, setSlotConfig } = useAppData();
  const who = useWho();
  const audit = useAudit();
  const toast = useToast();
  return useCallback((country: string) => {
    const cfg = configFor(slotConfig, country);
    setSlotConfig(prev => upsertConfig(prev, { ...cfg, lastCheckedAt: new Date().toISOString(), lastCheckedBy: who }));
    audit('Source', 'Marked the official page as checked', { country });
    toast(`${country}: marked as checked`);
  }, [slotConfig, setSlotConfig, who, audit, toast]);
}

export const officialLink = (country: string, cfgs: SlotConfig[]) => configFor(cfgs, country).officialUrl || providerRow(country)?.officialUrl || '';
const stateTone = (s: SourceHealth['state']) => (s === 'Fresh' ? TONE.good : s === 'Due' ? TONE.warn : s === 'Paused' ? TONE.neutral : TONE.bad);
const healthText = (h: SourceHealth, cfg: SlotConfig) =>
  h.state === 'Never checked' ? 'Never checked' : h.state === 'Paused' ? 'Paused'
    : `${h.state} · checked ${h.hoursSince !== null && h.hoursSince < 1 ? 'just now' : `${Math.round(h.hoursSince || 0)} h ago`}${cfg.lastCheckedBy ? ` by ${cfg.lastCheckedBy}` : ''}`;

export function CategoryChip({ cat }: { cat: AlertCategory }) {
  const i = CATEGORY_INFO[cat];
  return <span className="chip" style={{ ...TONE[i.tone], fontWeight: 700 }} title={i.meaning}>{i.short}</span>;
}

const nowPkt = () => { const d = new Date(Date.now() + 5 * 3600 * 1000); return { date: pktDate(Date.now()), time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }; };
export const ALERT_COUNTRIES = [...FIVE_COUNTRIES as readonly string[], ...SLOT_COUNTRIES.filter(c => !(FIVE_COUNTRIES as readonly string[]).includes(c) && c !== 'Schengen')];

// ---------------------------------------------------------------------------------------------
// Countries — the five at a glance
// ---------------------------------------------------------------------------------------------
export function OverviewTab({ now, onGo, onLog, onLive }: { now: number; onGo: (t: SlotTab) => void; onLog: (country: string) => void; onLive: (country: string) => void }) {
  const { slotWaiting, slotAlerts, slotConfig } = useAppData();
  const markChecked = useMarkChecked();
  const month = pktDate(now).slice(0, 7);
  const rows = FIVE_COUNTRIES.map(country => {
    const mine = slotWaiting.filter(x => countryMatches(x.country, country));
    const cfg = configFor(slotConfig, country);
    return {
      country, cfg, health: sourceHealth(country, cfg, slotAlerts, now),
      waiting: mine.filter(isWaiting).length, urgent: mine.filter(x => isWaiting(x) && x.priority === 'Urgent').length,
      booked: mine.filter(x => x.status === 'Booked' && (x.bookedAt || '').slice(0, 7) === month).length,
      next: upcomingOfficial(slotAlerts.filter(a => a.country === country), now)[0] || null,
    };
  });
  const ahead = upcomingOfficial(slotAlerts, now);
  const toCheck = rows.filter(r => r.health.state === 'Due' || r.health.state === 'Overdue' || r.health.state === 'Never checked').length;
  const latest = sortAlerts(slotAlerts).slice(0, 6);
  return (
    <div data-testid="slot-overview">
      <div className="grid gap-3.5 mb-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Waiting in these five" value={rows.reduce((s, r) => s + r.waiting, 0)} hint="clients without a date" icon="appointments" testid="slot-ov-waiting" />
        <StatCard label="Official releases ahead" value={ahead.length} hint="announced with a date and time" color="var(--green)" icon="appraisal" testid="slot-ov-ahead" />
        <StatCard label="Dates seen, last 7 days" value={rows.reduce((s, r) => s + r.health.observations7d, 0)} hint="reported by staff or clients" color="var(--gold)" icon="attendance" testid="slot-ov-seen" />
        <StatCard label="Pages to check" value={toCheck} hint="official page not looked at in time" color="var(--red)" icon="complaints" testid="slot-ov-tocheck" />
      </div>
      <Callout tone="info" title="Nothing here watches a website">
        None of the five providers offers an approved feed, API or alert service, and BLS and VFS block automatic booking tools. So this screen does the part that is allowed and useful: it makes sure someone looks at the official page, files exactly what they see (and how sure we are), and gets the right people moving.
      </Callout>
      <div className="grid gap-3.5 mt-4 max-lg:grid-cols-1" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {rows.map(r => {
          const link = officialLink(r.country, slotConfig);
          return (
            <section key={r.country} className="panel" data-testid="slot-ov-card" data-country={r.country}>
              <div className="panel-body">
                <div className="flex justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-display font-semibold text-[16.5px]" style={{ color: 'var(--accent-ink)' }}>{r.country}{PRIORITY_COUNTRIES.includes(r.country) ? ' ★' : ''}</div>
                    <div className="text-[12.5px] text-[var(--muted)]">{providerRow(r.country)?.provider.split(' — ')[0].split(', reached')[0]}</div>
                  </div>
                  <span className="chip" style={TONE.neutral} title={adapterFor(r.country).reason} data-testid="slot-ov-mode">Manual · no approved feed</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div><b className="font-display text-xl" data-testid="slot-ov-c-waiting">{r.waiting}</b><div className="text-[11.5px] text-[var(--muted)]">waiting</div></div>
                  <div><b className="font-display text-xl" style={{ color: r.urgent ? 'var(--red)' : undefined }}>{r.urgent}</b><div className="text-[11.5px] text-[var(--muted)]">urgent</div></div>
                  <div><b className="font-display text-xl">{r.booked}</b><div className="text-[11.5px] text-[var(--muted)]">booked this month</div></div>
                </div>
                <div className="text-[13px] mt-3" data-testid="slot-ov-release"><span className="text-[var(--muted)]">Official release: </span>{r.next ? <b>{fmtOpens(r.next.opensDate, r.next.opensTime)}</b> : <span>none announced</span>}</div>
                <div className="text-[13px] mt-1" data-testid="slot-ov-last"><span className="text-[var(--muted)]">Last alert: </span>{r.health.last ? <>{CATEGORY_INFO[r.health.last.category].short} · {agoLabel(r.health.last.at, now)}</> : 'none yet'}</div>
                <div className="mt-2"><span className="chip" style={stateTone(r.health.state)} data-testid="slot-ov-health">{healthText(r.health, r.cfg)}</span></div>
                <div className="flex gap-1.5 flex-wrap mt-3.5">
                  <button className="btn btn-sm btn-primary" onClick={() => markChecked(r.country)} data-testid="slot-ov-checked">Mark page checked</button>
                  <button className="btn btn-sm" onClick={() => onLog(r.country)} data-testid="slot-ov-log">Log an alert</button>
                  <button className="btn btn-sm" onClick={() => onLive(r.country)} data-testid="slot-ov-live">Live board</button>
                  {link && <a className="btn btn-sm btn-ghost" href={link} target="_blank" rel="noreferrer" data-testid="slot-ov-open">Official page ↗</a>}
                </div>
              </div>
            </section>
          );
        })}
        <section className="panel">
          <div className="panel-body">
            <div className="font-display font-semibold text-[16.5px]" style={{ color: 'var(--accent-ink)' }}>Other countries</div>
            <div className="text-[13px] text-[var(--muted)] mt-1 mb-3">Italy and the Netherlands have a “Where to book” card; every other Schengen country is still to be checked. They use the same alerts and waiting list.</div>
            <div className="flex gap-1.5 flex-wrap"><button className="btn btn-sm" onClick={() => onGo('guide')}>Where to book</button><button className="btn btn-sm" onClick={() => onLog('')}>Log an alert</button></div>
          </div>
        </section>
      </div>
      <div className="mt-4">
        <Panel title="Latest alerts" subtitle="Newest first, all countries" flush action={<button className="btn btn-sm" onClick={() => onGo('alerts')}>All alerts</button>} testid="slot-ov-latest">
          {!latest.length ? <div className="p-5 text-[13px] text-[var(--muted)]">No alerts yet. Log the first one when the team sees something, or when an official notice is published.</div> : (
            <div className="overflow-auto"><table>
              <thead><tr><th>Type</th><th>Country</th><th>What it says</th><th>When</th></tr></thead>
              <tbody>{latest.map(a => <tr key={a.id}><td><CategoryChip cat={a.category} /></td><td>{a.country}{a.centre ? ` · ${a.centre}` : ''}</td><td className="text-[13px]">{claimOf(a)}</td><td className="whitespace-nowrap text-[12.5px]">{fmtPkt(a.at)}</td></tr>)}</tbody>
            </table></div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------------------------
export function AlertsTab({ now, onLog, onTeam, onLive }: { now: number; onLog: (country: string) => void; onTeam: (a: SlotAlert) => void; onLive: (country: string, centre: string) => void }) {
  const { slotAlerts, setSlotAlerts, slotNotices, setSlotNotices, slotConfig } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const who = useWho();
  const markChecked = useMarkChecked();
  const [country, setCountry] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(true);
  const stored = sortAlerts(slotAlerts).filter(a => (!country || a.country === country) && (!cat || a.category === cat) && (!open || !a.handled));
  const reminders = systemAlerts(FIVE_COUNTRIES, slotConfig, slotAlerts, now).filter(a => (!country || a.country === country) && (!cat || a.category === cat));
  const countries = [...new Set([...FIVE_COUNTRIES as readonly string[], ...slotAlerts.map(a => a.country)])];
  const handle = (a: SlotAlert, on: boolean) => { setSlotAlerts(prev => prev.map(x => x.id === a.id ? { ...x, handled: on, handledBy: on ? who : '', handledAt: on ? new Date().toISOString() : '' } : x)); audit('Alert', on ? 'Marked an alert as handled' : 'Reopened an alert', { country: a.country, ref: CATEGORY_INFO[a.category].short }); };
  const remove = (a: SlotAlert) => { setSlotAlerts(prev => prev.filter(x => x.id !== a.id)); audit('Alert', 'Removed an alert', { country: a.country, ref: CATEGORY_INFO[a.category].short, detail: 'Logged by ' + a.loggedBy }); toast('Alert removed'); };
  const notices = [...slotNotices].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  const setStatus = (id: string, status: 'Sent' | 'Failed') => {
    const n = slotNotices.find(x => x.id === id);
    setSlotNotices(prev => prev.map(x => x.id === id ? { ...x, status } : x));
    if (n) audit('Notice', status === 'Sent' ? 'Confirmed an alert was sent' : 'Marked an alert as failed', { ref: n.toName, detail: `attempt ${n.attempt}` });
  };
  return (
    <div data-testid="slot-alerts">
      <div className="flex gap-2 flex-wrap items-center mb-4">
        <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: 150 }} data-testid="slot-alerts-country"><option value="">All countries</option>{countries.map(c => <option key={c}>{c}</option>)}</select>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ width: 230 }} data-testid="slot-alerts-cat"><option value="">All types</option>{ALERT_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_INFO[c].short}</option>)}</select>
        <label className="flex items-center gap-1.5 text-xs" style={{ margin: 0 }}><input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)} data-testid="slot-alerts-open" /> Hide handled</label>
        <span className="flex-1" />
        <button className="btn btn-sm" onClick={() => { if (!downloadCsv('slot-alerts', alertsReport(stored), ALERT_COLUMNS)) toast('Nothing to download'); }} data-testid="slot-csv-alerts">Download CSV</button>
        <button className="btn btn-sm btn-primary" onClick={() => onLog(country)} data-testid="slot-alert-add">+ Log an alert</button>
      </div>

      {reminders.length > 0 && (
        <div className="mb-4" data-testid="slot-reminders">
          <Callout tone="warn" title={`${reminders.length} official page${reminders.length === 1 ? '' : 's'} not checked in time`}>
            <div className="flex flex-col gap-1.5 mt-1">
              {reminders.map(a => (
                <div key={a.id} className="flex items-center gap-2 flex-wrap" data-testid="slot-reminder" data-country={a.country}>
                  <b>{a.country}</b><span className="text-[12.5px]">{a.note}</span>
                  <span className="flex-1" />
                  {officialLink(a.country, slotConfig) && <a className="btn btn-sm btn-ghost" href={officialLink(a.country, slotConfig)} target="_blank" rel="noreferrer">Open page ↗</a>}
                  <button className="btn btn-sm" onClick={() => markChecked(a.country)} data-testid="slot-reminder-checked">I checked it</button>
                </div>
              ))}
            </div>
          </Callout>
        </div>
      )}

      {!stored.length ? <EmptyState title="No alerts in this view" body="Log an alert when the team sees dates on a booking site, when an embassy or provider publishes a notice, or when an official page will not open." action={<button className="btn btn-primary" onClick={() => onLog(country)}>+ Log an alert</button>} /> : (
        <div className="flex flex-col gap-3">
          {stored.map(a => {
            const info = CATEGORY_INFO[a.category];
            const link = officialLink(a.country, slotConfig);
            return (
              <section key={a.id} className="panel" data-testid="slot-alert-card" data-category={a.category} data-country={a.country} data-verification={a.verification} style={{ opacity: a.handled ? .65 : 1, borderLeft: `4px solid ${TONE[info.tone].color}` }}>
                <div className="panel-body">
                  <div className="flex gap-2 flex-wrap items-center">
                    <CategoryChip cat={a.category} />
                    <span className="chip" style={a.verification === 'Official notice' ? TONE.good : a.verification === 'Seen by staff' ? TONE.info : TONE.warn} data-testid="slot-alert-verif">{a.verification}</span>
                    <b>{a.country}{a.centre ? ` · ${a.centre}` : ''}</b>
                    <span className="text-[12.5px] text-[var(--muted)]">{a.provider}</span>
                    <span className="flex-1" />
                    <span className="text-[12.5px] text-[var(--muted)]" data-testid="slot-alert-time">{a.category === 'OFFICIAL RELEASE ANNOUNCED' || a.category === 'OFFICIALLY CONFIRMED FUTURE RELEASE' ? 'Announced' : 'Seen'} {fmtPkt(a.at)} · {agoLabel(a.at, now)}</span>
                  </div>
                  <div className="text-[14px] font-semibold mt-2" data-testid="slot-alert-claim">{claimOf(a)}</div>
                  <div className="text-[13px] mt-1" data-testid="slot-alert-next"><span className="text-[var(--muted)]">Next: </span>{nextAction(a)}</div>
                  <div className="text-[12.5px] mt-2 text-[var(--muted)]" data-testid="slot-alert-source">
                    Source: {a.source}{a.sourceUrl ? <> — <a href={a.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', textDecoration: 'underline' }}>link</a></> : ''} · logged by {a.loggedBy || '—'}{a.note ? ` · ${a.note}` : ''}
                    {a.handled && <> · handled by {a.handledBy || '—'}</>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-3">
                    {link && <a className="btn btn-sm btn-primary" href={link} target="_blank" rel="noreferrer" data-testid="slot-alert-book">Official booking page ↗</a>}
                    <button className="btn btn-sm" onClick={() => onTeam(a)} data-testid="slot-alert-team">Alert the team</button>
                    <button className="btn btn-sm" onClick={() => onLive(a.country, a.centre)}>Live board</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handle(a, !a.handled)} data-testid="slot-alert-handle">{a.handled ? 'Reopen' : 'Mark handled'}</button>
                    <button className="btn btn-sm btn-ghost btn-danger" onClick={() => { if (confirm('Remove this alert?')) remove(a); }} data-testid="slot-alert-remove">Remove</button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        <Panel title="Who was told" subtitle="The portal opens WhatsApp for a person to send — it cannot see whether the message went, so staff confirm" flush testid="slot-notices"
          action={<button className="btn btn-sm" onClick={() => { if (!downloadCsv('slot-notifications', noticesReport(notices), NOTICE_COLUMNS)) toast('Nothing to download'); }} data-testid="slot-csv-notices">Download CSV</button>}>
          {!notices.length ? <div className="p-5 text-[13px] text-[var(--muted)]">Nobody has been alerted yet.</div> : (
            <div className="overflow-auto"><table data-testid="slot-notice-table">
              <thead><tr><th>When</th><th>To</th><th>How</th><th>Status</th><th>Try</th><th>By</th><th></th></tr></thead>
              <tbody>{notices.slice(0, 40).map(n => (
                <tr key={n.id} data-testid="slot-notice-row" data-status={n.status} data-to={n.toName}>
                  <td className="whitespace-nowrap text-[12.5px]">{fmtPkt(n.at)}</td><td className="font-medium">{n.toName}</td><td>{n.channel}</td>
                  <td><span className="chip" style={n.status === 'Sent' ? TONE.good : n.status === 'Failed' ? TONE.bad : TONE.warn}>{n.status}</span></td>
                  <td>{n.attempt}</td><td>{n.by}</td>
                  <td>{n.status === 'Opened' && <div className="flex gap-1.5 justify-end"><button className="btn btn-sm" onClick={() => setStatus(n.id, 'Sent')} data-testid="slot-notice-sent">Sent ✓</button><button className="btn btn-sm btn-ghost btn-danger" onClick={() => setStatus(n.id, 'Failed')} data-testid="slot-notice-failed">Did not go</button></div>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Log an alert
// ---------------------------------------------------------------------------------------------
const DEFAULT_SOURCE: Record<string, string> = { announcement: 'Official notice page', observation: 'Provider booking site (checked by our staff)', caution: 'WhatsApp / agent message', error: 'Provider booking site (checked by our staff)' };

export function AlertLogForm({ country: c0, onClose }: { country: string; onClose: () => void }) {
  const { slotAlerts, setSlotAlerts, setSlotReleases, slotConfig } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const who = useWho();
  const [category, setCategory] = useState<AlertCategory>('APPOINTMENT AVAILABILITY OBSERVED');
  const [country, setCountry] = useState(c0 || 'Belgium');
  const [centre, setCentre] = useState('');
  const info = CATEGORY_INFO[category];
  const [source, setSource] = useState<string>(DEFAULT_SOURCE.observation);
  const [url, setUrl] = useState('');
  const [verification, setVerification] = useState<AlertVerification>('Seen by staff');
  const [opensDate, setOpensDate] = useState('');
  const [opensTime, setOpensTime] = useState('15:00');
  const seen = nowPkt();
  const [date, setDate] = useState(seen.date);
  const [time, setTime] = useState(seen.time);
  const [note, setNote] = useState('');
  const [addRelease, setAddRelease] = useState(true);
  const [error, setError] = useState('');

  function pickCategory(c: AlertCategory) {
    const i = CATEGORY_INFO[c];
    setCategory(c); setVerification(i.verifications[0]); setSource(DEFAULT_SOURCE[i.kind]); setError('');
    if (i.kind === 'announcement' && !url) setUrl(officialLink(country, slotConfig));
  }
  function pickCountry(v: string) { setCountry(v); setError(''); if (info.kind === 'announcement') setUrl(officialLink(v, slotConfig)); }

  function save() {
    const atMs = pktToMs(date, time);
    const r = ingest(adapterFor(country), {
      category, country, centre, source, sourceUrl: url, verification, opensDate: opensDate || undefined, opensTime: opensDate ? opensTime : undefined, note, by: who,
      atIso: Number.isFinite(atMs) ? new Date(atMs).toISOString() : '', via: 'person',
    }, slotAlerts, Date.now(), genId('al'));
    if (r.error) { setError(r.error); return; }
    if (r.duplicate) { setError(`Already logged: ${CATEGORY_INFO[r.duplicate.category].short} for ${r.duplicate.country} at ${fmtPkt(r.duplicate.at)} by ${r.duplicate.loggedBy || '—'}. Nothing was added twice.`); return; }
    const a = r.alert!;
    setSlotAlerts(prev => [...prev, a]);
    audit('Alert', `Logged: ${info.short}`, { country, ref: a.centre || a.provider, detail: `${a.verification} · ${a.source}` });
    if (category === 'OFFICIALLY CONFIRMED FUTURE RELEASE' && addRelease) {
      const rel: SlotRelease = {
        id: genId('sr'), country, centre: a.centre, label: `${country} — official release`, time: a.opensTime, days: [], oneOffDate: a.opensDate, rota: [],
        note: `From an official notice logged by ${who || 'the team'}.`, active: true, basis: 'Official notice', sourceUrl: a.sourceUrl,
      };
      setSlotReleases(prev => prev.some(x => x.oneOffDate === rel.oneOffDate && x.time === rel.time && x.country === country && (x.centre || '') === rel.centre) ? prev : [...prev, rel]);
      audit('Release', 'Added an official release time', { country, ref: rel.label, detail: `${a.opensDate} ${a.opensTime}` });
    }
    toast('Alert logged'); onClose();
  }

  return (
    <>
      <ModalTitle>Log an alert</ModalTitle>
      <Field label="What kind of alert is it?">
        <select value={category} onChange={e => pickCategory(e.target.value as AlertCategory)} data-testid="slot-alf-category">{ALERT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <div className="text-[12px] text-[var(--muted)] mt-1" data-testid="slot-alf-meaning">{info.meaning}</div>
      </Field>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field label="Country"><select value={country} onChange={e => pickCountry(e.target.value)} data-testid="slot-alf-country">{ALERT_COUNTRIES.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Centre / city (optional)"><input value={centre} onChange={e => setCentre(e.target.value)} placeholder="e.g. Islamabad" data-testid="slot-alf-centre" /></Field>
        <Field label="Where did it come from?"><select value={source} onChange={e => setSource(e.target.value)} data-testid="slot-alf-source">{SOURCE_CHOICES.map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="How sure are we?"><select value={verification} onChange={e => setVerification(e.target.value as AlertVerification)} data-testid="slot-alf-verif">{info.verifications.map(v => <option key={v}>{v}</option>)}</select></Field>
      </div>
      <Field label={verification === 'Official notice' ? 'Link to the official notice (required)' : 'Link (optional)'}><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" data-testid="slot-alf-url" /></Field>
      {(info.needsOpens || info.key === 'OFFICIAL RELEASE ANNOUNCED') && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={info.needsOpens ? 'New dates open on (date)' : 'New dates open on (if the notice says)'}><input type="date" value={opensDate} onChange={e => setOpensDate(e.target.value)} data-testid="slot-alf-opens-date" /></Field>
          <Field label="At (Pakistan time)"><input type="time" value={opensTime} onChange={e => setOpensTime(e.target.value)} data-testid="slot-alf-opens-time" /></Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date it was seen / noticed"><input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="slot-alf-date" /></Field>
        <Field label="Time (Pakistan time)"><input type="time" value={time} onChange={e => setTime(e.target.value)} data-testid="slot-alf-time" /></Field>
      </div>
      <Field label="Note"><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything the team should know" data-testid="slot-alf-note" /></Field>
      {info.needsOpens && <label className="flex items-center gap-2 text-[13px] mb-2" style={{ margin: 0 }}><input type="checkbox" checked={addRelease} onChange={e => setAddRelease(e.target.checked)} data-testid="slot-alf-addrelease" /> Also add it to “Release times &amp; rota”, so the countdown and the rota follow it</label>}
      {error && <div className="mt-2"><Callout tone="bad"><span data-testid="slot-alf-error">{error}</span></Callout></div>}
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} data-testid="slot-alf-save">Save alert</button></ModalFoot>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Providers and integration health
// ---------------------------------------------------------------------------------------------
export function ProvidersTab({ now, onLog }: { now: number; onLog: (country: string) => void }) {
  const { slotAlerts, slotConfig } = useAppData();
  const markChecked = useMarkChecked();
  const [editing, setEditing] = useState<string | null>(null);
  const errors = sortAlerts(slotAlerts.filter(a => a.category === 'PROVIDER SOURCE UNAVAILABLE')).slice(0, 10);
  const vTone = (v: string) => (v === 'Verified on an official page' ? TONE.good : v === 'Partly verified' ? TONE.warn : TONE.neutral);
  return (
    <div data-testid="slot-providers">
      <Callout tone="warn" title="Automatic checking is OFF for all five countries">
        <span data-testid="slot-prov-verdict">No provider offers an approved feed, API or alert service that we may connect to. BLS says it blocks automatic booking tools and VFS has added an SMS code to limit agents, so a monitor that logs in or reads their booking pages would break their rules and could get the team’s access blocked. The adapters below therefore stay in manual mode: people report what they see, and the engine checks it, files it once and shows exactly how sure we are.
        If a provider ever approves access in writing, it plugs into the same engine without changing the screens.</span>
      </Callout>

      <div className="mt-4">
        <Panel title="Provider research" subtitle="Read on 16 October 2026 — anything not read is marked, not guessed" flush testid="slot-prov-panel">
          <div className="overflow-auto">
            <table data-testid="slot-provider-table" className="cells-top" style={{ minWidth: 1100 }}>
              <thead><tr><th>Country</th><th>Provider</th><th>Official URL</th><th>Advance release information</th><th>Approved integration available?</th><th>Verification evidence</th><th>Implementation status</th></tr></thead>
              <tbody>{PROVIDER_TABLE.map(r => (
                <tr key={r.country} data-testid="slot-prov-row" data-country={r.country} style={{ verticalAlign: 'top' }}>
                  <td className="font-semibold">{r.country}<div className="text-[11.5px] font-normal text-[var(--muted)]">{r.centres}</div></td>
                  <td className="text-[13px]" style={{ minWidth: 190 }}>{r.provider}</td>
                  <td className="text-[12.5px]"><a href={r.officialUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', textDecoration: 'underline', wordBreak: 'break-all' }}>{r.officialUrl.replace(/^https:\/\//, '').slice(0, 48)}…</a></td>
                  <td className="text-[13px]" style={{ minWidth: 200 }}>{r.advanceRelease}</td>
                  <td className="text-[13px]" style={{ minWidth: 220 }}><b data-testid="slot-prov-integration">No.</b> {r.integration}
                    <details className="mt-1"><summary className="text-[12px] cursor-pointer" style={{ color: 'var(--accent-ink)' }}>Is automatic monitoring allowed? Who may book?</summary>
                      <div className="text-[12.5px] mt-1"><b>Monitoring:</b> {r.automation}</div><div className="text-[12.5px] mt-1"><b>Who books:</b> {r.whoBooks}</div></details></td>
                  <td className="text-[12.5px]" style={{ minWidth: 220 }}><span className="chip" style={vTone(r.verified)} data-testid="slot-prov-verified">{r.verified}</span><div className="mt-1 text-[var(--muted)]">{r.verifiedNote}</div>
                    <div className="mt-1 flex flex-col gap-0.5">{r.evidence.map(e => <a key={e.url} href={e.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-ink)', textDecoration: 'underline' }}>{e.label}</a>)}</div></td>
                  <td className="text-[13px]" style={{ minWidth: 190 }}><span className="chip" style={TONE.neutral}>Manual</span> {r.status}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Integration health" subtitle="Is someone looking at each official page, and has anything gone wrong?" flush testid="slot-health">
          <div className="overflow-auto"><table data-testid="slot-health-table">
            <thead><tr><th>Country</th><th>Mode</th><th>Official page</th><th>Alerts, 7 days</th><th>Page not opening</th><th></th></tr></thead>
            <tbody>{FIVE_COUNTRIES.map(country => {
              const cfg = configFor(slotConfig, country);
              const h = sourceHealth(country, cfg, slotAlerts, now);
              const ad = ADAPTERS.find(a => a.country === country)!;
              return (
                <tr key={country} data-testid="slot-health-row" data-country={country} data-state={h.state}>
                  <td className="font-semibold">{country}</td>
                  <td><span className="chip" style={TONE.neutral} title={ad.reason}>{ad.mode === 'manual' ? 'Manual' : 'Feed'}</span></td>
                  <td><span className="chip" style={stateTone(h.state)}>{healthText(h, cfg)}</span><div className="text-[11.5px] text-[var(--muted)] mt-0.5">every {cfg.checkEveryHours} h{cfg.enabled ? '' : ' · paused'}</div></td>
                  <td className="font-mono-ui">{h.alerts7d}</td>
                  <td className="font-mono-ui" style={{ color: h.errors7d ? 'var(--red)' : undefined }}>{h.errors7d}</td>
                  <td><div className="flex gap-1.5 justify-end flex-wrap">
                    <button className="btn btn-sm btn-primary" onClick={() => markChecked(country)} data-testid="slot-health-checked">Mark checked</button>
                    <button className="btn btn-sm" onClick={() => onLog(country)}>Log an alert</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(country)} data-testid="slot-health-settings">Settings</button>
                  </div></td>
                </tr>);
            })}</tbody>
          </table></div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Error log" subtitle="Times an official page would not open" flush testid="slot-errorlog">
          {!errors.length ? <div className="p-5 text-[13px] text-[var(--muted)]">No errors logged. If an official page will not open, log “Source not opening” so it is recorded here.</div> : (
            <div className="overflow-auto"><table>
              <thead><tr><th>When</th><th>Country</th><th>Source</th><th>By</th><th>Note</th></tr></thead>
              <tbody>{errors.map(a => <tr key={a.id} data-testid="slot-error-row"><td className="whitespace-nowrap text-[12.5px]">{fmtPkt(a.at)}</td><td>{a.country}</td><td>{a.source}</td><td>{a.loggedBy}</td><td className="text-[12.5px] text-[var(--muted)]">{a.note}</td></tr>)}</tbody>
            </table></div>
          )}
        </Panel>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)}>{editing && <ConfigForm country={editing} onClose={() => setEditing(null)} />}</Modal>
    </div>
  );
}

function ConfigForm({ country, onClose }: { country: string; onClose: () => void }) {
  const { slotConfig, setSlotConfig, team } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const [f, setF] = useState<SlotConfig>(configFor(slotConfig, country));
  const staff = team.filter(t => t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave');
  const toggle = (id: string) => setF(p => ({ ...p, notify: p.notify.includes(id) ? p.notify.filter(x => x !== id) : [...p.notify, id] }));
  function save() {
    const hours = Math.round(Number(f.checkEveryHours));
    if (!(hours >= 1 && hours <= 168)) { toast('Check every: choose between 1 and 168 hours'); return; }
    if (f.officialUrl.trim() && !/^https?:\/\//i.test(f.officialUrl.trim())) { toast('The link must start with https://'); return; }
    setSlotConfig(prev => upsertConfig(prev, { ...f, checkEveryHours: hours, officialUrl: f.officialUrl.trim() }));
    audit('Settings', 'Changed country settings', { country, detail: `check every ${hours} h${f.enabled ? '' : ', paused'}` });
    toast('Saved'); onClose();
  }
  return (
    <>
      <ModalTitle>{country} — settings</ModalTitle>
      <Field label="Official page the team checks (notices or booking)"><input value={f.officialUrl} onChange={e => setF(p => ({ ...p, officialUrl: e.target.value }))} placeholder={providerRow(country)?.officialUrl || 'https://…'} data-testid="slot-cf-url" /></Field>
      <Field label="Someone must look at it at least every (hours)"><input type="number" min={1} max={168} value={f.checkEveryHours} onChange={e => setF(p => ({ ...p, checkEveryHours: Number(e.target.value) }))} data-testid="slot-cf-hours" /></Field>
      <Field label="Alert these people first for this country">
        <div className="flex gap-1.5 flex-wrap" data-testid="slot-cf-notify">{staff.map(t => <button key={t.id} className={`btn btn-sm ${f.notify.includes(t.id) ? 'btn-primary' : ''}`} onClick={() => toggle(t.id)} data-testid="slot-cf-person">{t.name}</button>)}</div>
      </Field>
      <label className="flex items-center gap-2 text-[13px]" style={{ margin: 0 }}><input type="checkbox" checked={f.enabled} onChange={e => setF(p => ({ ...p, enabled: e.target.checked }))} data-testid="slot-cf-enabled" /> Remind us to check this country’s page</label>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} data-testid="slot-cf-save">Save</button></ModalFoot>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Audit trail and clean-up
// ---------------------------------------------------------------------------------------------
export function AuditTab() {
  const { slotAudit, setSlotAudit, slotWaiting, setSlotWaiting, team } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const [text, setText] = useState('');
  const [area, setArea] = useState('');
  const [by, setBy] = useState('');
  const [country, setCountry] = useState('');
  const [days, setDays] = useState<number>(365);
  const rows = filterAudit(slotAudit, { text, area, by, country });
  const people = [...new Set(slotAudit.map(a => a.by))].sort();
  const countries = [...new Set(slotAudit.map(a => a.country).filter(Boolean))].sort();
  const cutoff = cutoffIso(today(), days);
  const oldCases = oldFinishedCases(slotWaiting, cutoff);
  const oldAudit = oldAuditEntries(slotAudit, cutoff);

  function clean() {
    if (!oldCases.length && !oldAudit.length) { toast('Nothing that old'); return; }
    if (!confirm(`Remove ${oldCases.length} finished client${oldCases.length === 1 ? '' : 's'} and ${oldAudit.length} audit line${oldAudit.length === 1 ? '' : 's'} older than ${days} days? This cannot be undone. Download the CSV first if you may need them.`)) return;
    const ids = new Set(oldCases.map(x => x.id));
    const aud = new Set(oldAudit.map(x => x.id));
    setSlotWaiting(prev => prev.filter(x => !ids.has(x.id)));
    setSlotAudit(prev => prev.filter(x => !aud.has(x.id)));
    audit('Data', 'Clean-up', { detail: `Removed ${oldCases.length} finished clients and ${oldAudit.length} audit lines older than ${days} days` });
    toast('Clean-up done');
  }
  return (
    <div data-testid="slot-audit">
      <Panel title="Audit trail" subtitle="Who did what, newest first. It records names and actions — never phone or passport details." flush testid="slot-audit-panel"
        action={<div className="flex gap-2 flex-wrap items-center">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Search" style={{ width: 150 }} data-testid="slot-audit-text" />
          <select value={area} onChange={e => setArea(e.target.value)} style={{ width: 120 }} data-testid="slot-audit-area"><option value="">All areas</option>{['Case', 'Alert', 'Release', 'Result', 'Notice', 'Source', 'Settings', 'Data'].map(a => <option key={a}>{a}</option>)}</select>
          <select value={by} onChange={e => setBy(e.target.value)} style={{ width: 130 }} data-testid="slot-audit-by"><option value="">Everyone</option>{people.map(p => <option key={p}>{p}</option>)}</select>
          <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: 130 }}><option value="">All countries</option>{countries.map(p => <option key={p}>{p}</option>)}</select>
          <button className="btn btn-sm" onClick={() => { if (!downloadCsv('slot-audit', auditReport(rows), AUDIT_COLUMNS)) toast('Nothing to download'); }} data-testid="slot-csv-audit">Download CSV</button>
        </div>}>
        {!rows.length ? <div className="p-5 text-[13px] text-[var(--muted)]">Nothing recorded yet.</div> : (
          <div className="overflow-auto"><table data-testid="slot-audit-table">
            <thead><tr><th>When</th><th>Who</th><th>Area</th><th>What happened</th><th>Country</th><th>About</th><th>Detail</th></tr></thead>
            <tbody>{rows.slice(0, 300).map(a => <tr key={a.id} data-testid="slot-audit-row" data-area={a.area}><td className="whitespace-nowrap text-[12.5px]">{fmtPkt(a.at)}</td><td>{a.by}</td><td><span className="chip" style={TONE.neutral}>{a.area}</span></td><td>{a.action}</td><td>{a.country}</td><td>{a.ref}</td><td className="text-[12.5px] text-[var(--muted)]">{a.detail}</td></tr>)}</tbody>
          </table></div>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title="Download a copy" subtitle="Spreadsheet files you can keep" testid="slot-export">
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-sm" onClick={() => { if (!downloadCsv('slot-clients', casesReport(slotWaiting, team), CASE_COLUMNS)) toast('Nothing to download'); }} data-testid="slot-csv-all-cases">All clients</button>
            <button className="btn btn-sm" onClick={() => { if (!downloadCsv('slot-audit-all', auditReport(slotAudit), AUDIT_COLUMNS)) toast('Nothing to download'); }}>Whole audit trail</button>
          </div>
          <div className="text-[12.5px] text-[var(--muted)] mt-2">The client file leaves out the booking-pack details (passport numbers and similar).</div>
        </Panel>
        <Panel title="Clean-up" subtitle="Clear out old finished work to keep personal data only as long as it is needed" testid="slot-retention">
          <div className="flex gap-2 items-center flex-wrap mb-2">
            <span className="text-[13px]">Older than</span>
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 130 }} data-testid="slot-retention-days">{RETENTION_CHOICES.map(d => <option key={d} value={d}>{d} days</option>)}</select>
          </div>
          <div className="text-[13px]" data-testid="slot-retention-count">{oldCases.length} finished (booked or cancelled) client{oldCases.length === 1 ? '' : 's'} and {oldAudit.length} audit line{oldAudit.length === 1 ? '' : 's'}. Clients still waiting are never touched.</div>
          <div className="mt-3"><button className="btn btn-sm btn-danger" onClick={clean} data-testid="slot-retention-run">Remove them</button></div>
          <div className="text-[12px] text-[var(--muted)] mt-2">Download the CSV first. The server keeps its data in files on the Render disk, so take a disk snapshot before big clean-ups — see the README for the steps.</div>
        </Panel>
      </div>
    </div>
  );
}

