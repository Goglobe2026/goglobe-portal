'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { genId } from '@/lib/constants';
import { ModalTitle, ModalFoot, Field } from '@/components/ui/Primitives';
import { StatCard, Panel, Callout, BarList } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import { pktDate } from '@/lib/slotdesk';
import { CATEGORY_INFO, agoLabel, configFor, fmtPkt, ingest, sourceHealth } from '@/lib/slotalerts';
import { FIVE_COUNTRIES, adapterFor } from '@/lib/slotproviders';
import {
  CHECK_ACTION, EVERY_CHOICES, MIN_CHECKS_FOR_PATTERN, checkStats, checksFromAudit, dueCountries, roundOrder, type CheckOutcome,
} from '@/lib/slotchecks';
import { TONE, officialLink, upsertConfig, useAudit, useWho } from '@/components/modules/SlotDeskPanels';
import { REMIND_WINDOW_TEXT, remindersOn, setRemindersOn } from '@/components/shell/SlotReminder';
import type { SlotAlert } from '@/lib/types';

// The check round. One person walks the official pages a few times a day; for each page she taps what she
// sees. The portal does the rest: it marks the page checked, files the alert with her name and the time, writes
// the audit line, and (when dates are showing) points her straight at the live board. It never opens or reads
// any website itself — she looks, the portal keeps the record.

const OBS_SOURCE = 'Provider booking site (checked by our staff)';
const OUTCOME_TEXT: Record<CheckOutcome, string> = { none: 'Nothing open', seen: 'Dates showing', down: 'Page not opening' };
const OUTCOME_TONE: Record<CheckOutcome, (typeof TONE)[keyof typeof TONE]> = { none: TONE.neutral, seen: TONE.good, down: TONE.bad };
const everyLabel = (h: number) => (h === 1 ? 'every hour' : h === 24 ? 'once a day' : `every ${h} hours`);

// ---------------------------------------------------------------------------------------------
// The panel at the top of the Countries tab
// ---------------------------------------------------------------------------------------------
export function RoundPanel({ now, onStart, onHistory }: { now: number; onStart: () => void; onHistory: () => void }) {
  const { slotConfig, setSlotConfig, slotAlerts, slotAudit } = useAppData();
  const audit = useAudit();
  const toast = useToast();
  const order = roundOrder(FIVE_COUNTRIES, slotConfig, slotAlerts, now);
  const due = dueCountries(FIVE_COUNTRIES, slotConfig, slotAlerts, now);
  const everys = [...new Set(FIVE_COUNTRIES.map(c => configFor(slotConfig, c).checkEveryHours))];
  const every = everys.length === 1 ? everys[0] : 0;
  const todayIso = pktDate(now);
  const today = checksFromAudit(slotAudit).filter(e => pktDate(e.atMs) === todayIso);
  const [on, setOn] = useState(() => (typeof window === 'undefined' ? true : remindersOn()));
  const [perm, setPerm] = useState<string>(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));

  function setEvery(h: number) {
    setSlotConfig(prev => FIVE_COUNTRIES.reduce((list, c) => upsertConfig(list, { ...configFor(list, c), checkEveryHours: h }), prev));
    audit('Settings', 'Changed how often the official pages are checked', { detail: `all five countries, ${everyLabel(h)}` });
    toast(`Pages are now due ${everyLabel(h)}`);
  }
  function allow() {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(p => setPerm(p)).catch(() => setPerm('denied'));
  }

  return (
    <Panel title="Check round" subtitle="One tap per page. The portal keeps the time, the name and the record." testid="slot-round-panel"
      action={<button className="btn btn-sm btn-ghost" onClick={onHistory} data-testid="slot-round-history">Check history</button>}>
      <div className="flex gap-5 flex-wrap items-center">
        <div>
          <div className="font-display text-[34px] leading-none font-semibold" style={{ color: due.length ? 'var(--red)' : 'var(--green)' }} data-testid="slot-round-due">{due.length}</div>
          <div className="text-[12px] text-[var(--muted)] mt-1">{due.length === 1 ? 'page to check' : 'pages to check'}</div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="flex gap-1.5 flex-wrap" data-testid="slot-round-chips">
            {order.map(o => (
              <span key={o.country} className="chip" style={o.state === 'Fresh' ? TONE.good : o.state === 'Due' ? TONE.warn : TONE.bad} data-testid="slot-round-chip" data-country={o.country} data-state={o.state}>
                {o.country} · {o.state === 'Never checked' ? 'never checked' : o.state === 'Fresh' ? 'up to date' : `${Math.round(o.hoursSince || 0)} h ago`}
              </span>
            ))}
          </div>
          <div className="text-[12.5px] text-[var(--muted)] mt-2" data-testid="slot-round-today">
            Today: {today.length} {today.length === 1 ? 'check' : 'checks'} · dates showing {today.filter(e => e.outcome === 'seen').length} times · page not opening {today.filter(e => e.outcome === 'down').length} times
          </div>
        </div>
        <button className="btn btn-primary" onClick={onStart} data-testid="slot-round-start">{due.length ? `Start check round (${due.length})` : 'Check all pages anyway'}</button>
      </div>

      <div className="flex gap-x-6 gap-y-2 flex-wrap items-center mt-4 pt-3.5 text-[13px]" style={{ borderTop: '1px solid var(--line, #E3E9F2)' }}>
        <label className="flex items-center gap-3" style={{ margin: 0 }}>Every page is due
          <select value={every || ''} onChange={e => setEvery(Number(e.target.value))} style={{ width: 150 }} data-testid="slot-round-every">
            {!every && <option value="">(different per country)</option>}
            {EVERY_CHOICES.map(h => <option key={h} value={h}>{everyLabel(h)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2" style={{ margin: 0 }}>
          <input type="checkbox" className="!w-auto" checked={on} onChange={e => { setOn(e.target.checked); setRemindersOn(e.target.checked); }} data-testid="slot-round-remind" /> Remind me on this computer
        </label>
        {perm === 'default' && <button className="btn btn-sm" onClick={allow} data-testid="slot-round-notify">Allow pop-up reminders</button>}
        {perm === 'granted' && <span className="text-[12px] text-[var(--muted)]" data-testid="slot-round-notify-on">Pop-ups allowed</span>}
        {perm === 'denied' && <span className="text-[12px] text-[var(--muted)]">Pop-ups are blocked in this browser</span>}
      </div>
      <div className="text-[12px] text-[var(--muted)] mt-2" data-testid="slot-round-note">
        Reminders show only while the portal is open in a browser: {REMIND_WINDOW_TEXT}. They cannot reach a closed computer or phone.
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// The walk-through
// ---------------------------------------------------------------------------------------------
export function RoundBody({ onClose, onTeam, onLive }: { onClose: () => void; onTeam: (a: SlotAlert) => void; onLive: (country: string, centre: string) => void }) {
  const { slotConfig, setSlotConfig, slotAlerts, setSlotAlerts } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const who = useWho();
  const [queue, setQueue] = useState<string[]>(() => dueCountries(FIVE_COUNTRIES, slotConfig, slotAlerts, Date.now()));
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<{ country: string; outcome: CheckOutcome | 'skipped' }[]>([]);
  const [centre, setCentre] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [filed, setFiled] = useState<{ alert: SlotAlert; again: boolean } | null>(null);

  const country = queue[idx];
  const next = () => { setIdx(i => i + 1); setCentre(''); setNote(''); setError(''); setFiled(null); };

  function record(outcome: CheckOutcome) {
    const t = Date.now();
    const iso = new Date(t).toISOString();
    const link = officialLink(country, slotConfig);
    let alert: SlotAlert | null = null; let again = false;
    if (outcome !== 'none') {
      const category = outcome === 'seen' ? 'APPOINTMENT AVAILABILITY OBSERVED' : 'PROVIDER SOURCE UNAVAILABLE';
      const r = ingest(adapterFor(country), {
        category, country, centre: outcome === 'seen' ? centre : '', source: OBS_SOURCE, sourceUrl: /^https?:\/\//i.test(link) ? link : '',
        verification: 'Seen by staff', note, by: who, atIso: iso, via: 'person',
      }, slotAlerts, t, genId('al'));
      if (r.error) { setError(r.error); return; }
      if (r.duplicate) { alert = r.duplicate; again = true; }
      else { alert = r.alert!; const a = alert; setSlotAlerts(prev => [...prev, a]); audit('Alert', `Logged: ${CATEGORY_INFO[category].short}`, { country, ref: a.centre || a.provider, detail: `${a.verification} · ${a.source}` }); }
    }
    // a page that would not open has not really been checked, so it stays on the list
    if (outcome !== 'down') setSlotConfig(prev => upsertConfig(prev, { ...configFor(prev, country), lastCheckedAt: iso, lastCheckedBy: who }));
    audit('Source', CHECK_ACTION[outcome], { country, ref: outcome === 'seen' ? centre.trim() : '', detail: again ? 'already logged a moment ago' : '' });
    setResults(r => [...r, { country, outcome }]);
    if (outcome === 'seen' && alert) { setFiled({ alert, again }); return; }
    toast(outcome === 'none' ? `${country}: nothing open — marked checked` : `${country}: page not opening — logged, it stays on the list`);
    next();
  }
  function skip() { setResults(r => [...r, { country, outcome: 'skipped' }]); next(); }
  function everything() { setQueue(roundOrder(FIVE_COUNTRIES, slotConfig, slotAlerts, Date.now()).map(r => r.country)); setIdx(0); }

  const dots = (
    <div className="flex gap-1.5 flex-wrap mb-4" data-testid="slot-round-progress">
      {queue.map((c, i) => {
        const res = results.find(r => r.country === c);
        return <span key={c} className="chip" data-country={c} data-result={res?.outcome || (i === idx ? 'current' : 'todo')}
          style={res ? (res.outcome === 'skipped' ? TONE.neutral : OUTCOME_TONE[res.outcome]) : i === idx ? TONE.info : { background: 'transparent', color: 'var(--muted)', border: '1px solid #E3E9F2' }}>{c}</span>;
      })}
    </div>
  );

  // nothing is due
  if (!queue.length) {
    return (
      <>
        <ModalTitle>Check round</ModalTitle>
        <div data-testid="slot-round-empty"><Callout tone="good" title="Every official page is up to date">Nothing needs looking at right now. You can still check all five if you want to.</Callout></div>
        <ModalFoot><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={everything} data-testid="slot-round-all">Check all five anyway</button></ModalFoot>
      </>
    );
  }

  // finished
  if (idx >= queue.length) {
    const count = (o: CheckOutcome) => results.filter(r => r.outcome === o).length;
    const skipped = results.filter(r => r.outcome === 'skipped').length;
    return (
      <>
        <ModalTitle>Round finished</ModalTitle>
        {dots}
        <div className="flex gap-2 flex-wrap mb-3" data-testid="slot-round-summary">
          <span className="chip" style={TONE.neutral} data-testid="slot-round-s-none">{count('none')} nothing open</span>
          <span className="chip" style={TONE.good} data-testid="slot-round-s-seen">{count('seen')} dates showing</span>
          <span className="chip" style={TONE.bad} data-testid="slot-round-s-down">{count('down')} not opening</span>
          {skipped > 0 && <span className="chip" style={TONE.neutral} data-testid="slot-round-s-skipped">{skipped} skipped</span>}
        </div>
        {(count('down') > 0 || skipped > 0) && <Callout tone="warn"><span data-testid="slot-round-left">{count('down') + skipped} {count('down') + skipped === 1 ? 'page was' : 'pages were'} not checked, so {count('down') + skipped === 1 ? 'it stays' : 'they stay'} on the list. A page that will not open is worth trying again in 15 minutes, from another phone or network.</span></Callout>}
        <ModalFoot><button className="btn btn-primary" onClick={onClose} data-testid="slot-round-close">Close</button></ModalFoot>
      </>
    );
  }

  const cfg = configFor(slotConfig, country);
  const h = sourceHealth(country, cfg, slotAlerts, Date.now());
  const link = officialLink(country, slotConfig);

  // dates were showing: send her to the board while it lasts
  if (filed) {
    const a = filed.alert;
    return (
      <>
        <ModalTitle>{country}: dates are showing</ModalTitle>
        {dots}
        <div data-testid="slot-round-seen-card"><Callout tone="warn" title="Move now — dates can vanish in minutes">
          {filed.again ? `This was already logged by ${a.loggedBy || 'someone'} at ${fmtPkt(a.at)}, so nothing was added twice. ` : 'Logged with your name and the time. '}
          Open the live board and call the first ready client. The client books in their own name; you stay on the call and guide.
        </Callout></div>
        <div className="flex gap-2 flex-wrap mt-4">
          <button className="btn btn-primary" onClick={() => onLive(country, a.centre)} data-testid="slot-round-live">Open the live board</button>
          <button className="btn" onClick={() => onTeam(a)} data-testid="slot-round-team">Alert the team</button>
          {link && <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer">Official page ↗</a>}
        </div>
        <ModalFoot><button className="btn btn-ghost" onClick={onClose} data-testid="slot-round-stop">Stop the round</button><button className="btn" onClick={next} data-testid="slot-round-continue">{idx + 1 < queue.length ? 'Continue the round' : 'Finish'}</button></ModalFoot>
      </>
    );
  }

  return (
    <>
      <ModalTitle>Check round · page {idx + 1} of {queue.length}</ModalTitle>
      {dots}
      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        <b className="font-display text-[22px]" data-testid="slot-round-country">{country}</b>
        <span className="text-[12.5px] text-[var(--muted)]" data-testid="slot-round-last">{h.state === 'Never checked' ? 'never checked in this portal' : `last checked ${agoLabel(cfg.lastCheckedAt, Date.now())}${cfg.lastCheckedBy ? ' by ' + cfg.lastCheckedBy : ''}`}</span>
      </div>
      <div className="mb-4">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">1 · Look at the official page</div>
        {link
          ? <a className="btn" href={link} target="_blank" rel="noreferrer" data-testid="slot-round-open">Open the {country} page ↗</a>
          : <span className="text-[13px]" data-testid="slot-round-nolink">No link saved for {country} yet — add it under Providers &amp; health.</span>}
      </div>
      <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">2 · Tap what you see</div>
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
        <button className="btn" style={{ padding: '14px 10px', fontWeight: 600 }} onClick={() => record('none')} data-testid="slot-round-none">Nothing is open</button>
        <button className="btn btn-primary" style={{ padding: '14px 10px', fontWeight: 600 }} onClick={() => record('seen')} data-testid="slot-round-seen">Dates are showing</button>
        <button className="btn btn-danger" style={{ padding: '14px 10px', fontWeight: 600 }} onClick={() => record('down')} data-testid="slot-round-down">The page will not open</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4 max-md:grid-cols-1">
        <Field label="Which centre or city? (only if dates are showing and you know)"><input value={centre} onChange={e => setCentre(e.target.value)} placeholder="e.g. Islamabad" data-testid="slot-round-centre" /></Field>
        <Field label="A note (optional)"><input value={note} onChange={e => setNote(e.target.value)} data-testid="slot-round-note-input" /></Field>
      </div>
      {error && <div className="mt-1"><Callout tone="bad"><span data-testid="slot-round-error">{error}</span></Callout></div>}
      <div className="text-[12px] text-[var(--muted)] mt-1">“Nothing is open” marks the page checked. “The page will not open” is logged but the page stays on the list, because you did not really see it.</div>
      <ModalFoot><button className="btn btn-ghost" onClick={skip} data-testid="slot-round-skip">Skip this one</button><button className="btn" onClick={onClose} data-testid="slot-round-stop">Stop the round</button></ModalFoot>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// What the checks have found (read back from the audit trail)
// ---------------------------------------------------------------------------------------------
export function CheckHistory({ now }: { now: number }) {
  const { slotAudit } = useAppData();
  const [days, setDays] = useState(14);
  const [country, setCountry] = useState('');
  const stats = checkStats(slotAudit, now, days, country);
  const recent = checksFromAudit(slotAudit).filter(e => !country || e.country === country).slice(-12).reverse();
  const rows = stats.windows.filter(w => w.checks > 0).map(w => ({ label: w.label, value: w.seen, note: `${w.checks} ${w.checks === 1 ? 'check' : 'checks'}`, color: w.seen ? 'var(--green)' : 'var(--accent)' }));
  return (
    <div data-testid="slot-checks">
      <div className="flex gap-2 flex-wrap items-center mb-3">
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 140 }} data-testid="slot-checks-days"><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select>
        <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: 150 }} data-testid="slot-checks-country"><option value="">All countries</option>{FIVE_COUNTRIES.map(c => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="grid gap-3.5 mb-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Checks done" value={stats.checks} hint="in check rounds" icon="attendance" testid="slot-checks-n" />
        <StatCard label="Dates showing" value={stats.seen} hint="times dates were seen" color="var(--green)" icon="appraisal" testid="slot-checks-seen" />
        <StatCard label="Page not opening" value={stats.down} hint="times a page failed to open" color="var(--red)" icon="complaints" testid="slot-checks-down" />
        <StatCard label="Dates seen in" value={stats.seenRate === null ? '—' : `${stats.seenRate}%`} hint="of the checks where the page opened" color="var(--gold)" icon="appointments" testid="slot-checks-rate" />
      </div>
      <Panel title="When were dates showing?" subtitle="Pakistan time, in three-hour stretches" testid="slot-checks-windows">
        {!rows.length ? <div className="text-[13px] text-[var(--muted)]" data-testid="slot-checks-empty">No checks yet. Do a check round and this fills in.</div> : <BarList rows={rows} />}
        <div className="text-[13px] mt-3" data-testid="slot-checks-best">
          {!stats.enough
            ? `Not enough checks yet for a pattern — about ${MIN_CHECKS_FOR_PATTERN} are needed (${stats.checks} so far).`
            : stats.best ? <>Dates were showing most often between <b>{stats.best.label}</b> ({stats.best.seen} of {stats.best.checks} checks).</> : 'Dates have not been showing in any of these checks.'}
        </div>
        <div className="text-[12px] text-[var(--muted)] mt-1">This only shows when we looked, not when the provider releases dates. A stretch with more checks will always look busier. Treat it as a hint for when to look more often, never as a promise.</div>
      </Panel>
      <div className="mt-4">
        <Panel title="Latest checks" subtitle="Who looked, when, and what they saw" flush testid="slot-checks-recent">
          {!recent.length ? <div className="p-5 text-[13px] text-[var(--muted)]">Nothing recorded yet.</div> : (
            <div className="overflow-auto"><table>
              <thead><tr><th>When</th><th>Country</th><th>What was seen</th><th>By</th></tr></thead>
              <tbody>{recent.map((e, i) => <tr key={i} data-testid="slot-checks-row" data-outcome={e.outcome}><td className="whitespace-nowrap text-[12.5px]">{fmtPkt(new Date(e.atMs).toISOString())}</td><td>{e.country}</td><td><span className="chip" style={OUTCOME_TONE[e.outcome]}>{OUTCOME_TEXT[e.outcome]}</span></td><td>{e.by}</td></tr>)}</tbody>
            </table></div>
          )}
        </Panel>
      </div>
    </div>
  );
}
