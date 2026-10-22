'use client';
import { useEffect, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { genId } from '@/lib/constants';
import { Field, EmptyState } from '@/components/ui/Primitives';
import { StatCard, Panel, Callout } from '@/components/ui/Kit';
import { SLOT_COUNTRIES, daysToTravel, pktDate, readiness, waUrl } from '@/lib/slotdesk';
import { MAX_ATTEMPTS, fmtPkt, sendState } from '@/lib/slotalerts';
import { FIVE_COUNTRIES } from '@/lib/slotproviders';
import {
  DEFAULT_PER_STAFF, PEOPLE_CHOICES, PER_STAFF_CHOICES, STANDBY_BASIS, basisError, capacityFor, matchWindow, missingItems, papersMessage, papersTopic, standbyMessage, standbyPlan,
  standbyTopic, whenLabel, windowError, windowFromReleases, type StandbyBasis, type StandbyWindow,
} from '@/lib/slotstandby';
import { TONE, useAudit, useWho } from '@/components/modules/SlotDeskPanels';
import type { SlotRequest, TeamMember } from '@/lib/types';

const WA_BTN = { background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff', borderColor: 'transparent' } as const;
const KEY = 'slot-standby-window';
const activeStaff = (team: TeamMember[]) => team.filter(t => t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave');
const COUNTRY_CHOICES = [...FIVE_COUNTRIES as readonly string[], ...SLOT_COUNTRIES.filter(c => !(FIVE_COUNTRIES as readonly string[]).includes(c) && c !== 'Schengen')];

/** What the viewer last planned, kept in this browser only (a convenience; the real record is the notification log). */
function loadSaved(): { w?: Partial<StandbyWindow>; per?: number; people?: number } {
  try { const s = window.localStorage.getItem(KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function save(w: StandbyWindow, per: number, people = 0) {
  try { window.localStorage.setItem(KEY, JSON.stringify({ w, per, people })); } catch { /* storage can be blocked */ }
}

export function StandbyTab({ now }: { now: number }) {
  const { slotWaiting, setSlotWaiting, slotReleases, slotAlerts, slotNotices, setSlotNotices, team } = useAppData();
  const audit = useAudit();
  const who = useWho();
  const todayIso = pktDate(now);

  // The window: which country, and when dates are expected to open (Pakistan time).
  const busiest = FIVE_COUNTRIES.map(c => ({ c, n: matchWindow(slotWaiting, { country: c, centre: '' }).length })).sort((a, b) => b.n - a.n)[0]?.c || 'Belgium';
  const [w, setW] = useState<StandbyWindow>(() => windowFromReleases(slotReleases, busiest, now) || { country: busiest, centre: '', date: '', time: '', basis: 'Our estimate' });
  const [per, setPer] = useState<number>(DEFAULT_PER_STAFF);
  const [people, setPeople] = useState<number>(0);   // 0 = work it out from the rota
  useEffect(() => {
    const s = loadSaved();
    if (s.per && (PER_STAFF_CHOICES as readonly number[]).includes(s.per)) setPer(s.per);
    if (s.people && (PEOPLE_CHOICES as readonly number[]).includes(s.people)) setPeople(s.people);
    if (s.w && s.w.country && s.w.date && s.w.time && !windowError({ ...(s.w as StandbyWindow) }, Date.now())) setW({ country: s.w.country, centre: s.w.centre || '', date: s.w.date, time: s.w.time, basis: s.w.basis === 'Official notice' ? 'Official notice' : 'Our estimate' });
  }, []);
  const change = (patch: Partial<StandbyWindow>, p = per) => { const next = { ...w, ...patch }; setW(next); save(next, p, people); };
  const changeCountry = (country: string) => { const next = windowFromReleases(slotReleases, country, now) || { country, centre: '', date: '', time: '', basis: 'Our estimate' as StandbyBasis }; setW(next); save(next, per, people); };
  const useNext = () => { const next = windowFromReleases(slotReleases, w.country, now); if (next) { setW(next); save(next, per, people); } };
  const hasNext = !!windowFromReleases(slotReleases, w.country, now);

  const err = windowError(w, now) || basisError(w, slotReleases, slotAlerts);
  const plan = standbyPlan(slotWaiting, w, per, team, slotReleases);
  // Seats: how many ready clients the people on the call can guide at once. With no rota entered, nobody is held back.
  const autoPeople = plan.hasRota && plan.onRota > 0 ? plan.onRota : Math.max(1, plan.staffNeeded);
  const cap = capacityFor(plan.ready, per, people || autoPeople);
  const nowIds = new Set(cap.now.map(x => x.id));
  const topic = err ? '' : standbyTopic(w);
  const ptopic = papersTopic(todayIso);
  const all = [...plan.ready, ...plan.nearly, ...plan.notReady];
  const told = plan.ready.filter(x => topic && sendState(slotNotices, x.id, topic).state === 'sent').length;
  const example = plan.ready[0];

  // ---- the notification log: the portal opens WhatsApp; staff confirm whether it went ----
  function opened(x: SlotRequest, kind: 'standby' | 'papers') {
    const tp = kind === 'standby' ? topic : ptopic;
    const st = sendState(slotNotices, x.id, tp);
    setSlotNotices(prev => [...prev, { id: genId('sn'), alertId: '', topic: tp, to: x.id, toName: x.clientName, channel: 'WhatsApp', status: 'Opened', attempt: st.attempts + 1, at: new Date().toISOString(), by: who }]);
    audit('Notice', kind === 'standby' ? 'Opened a WhatsApp stand-by message' : 'Opened a WhatsApp papers reminder', { country: x.country, ref: x.clientName, detail: `try ${st.attempts + 1} of ${MAX_ATTEMPTS}${kind === 'standby' ? ' · ' + whenLabel(w) : ''}` });
  }
  function mark(noticeId: string, x: SlotRequest, status: 'Sent' | 'Failed', kind: 'standby' | 'papers') {
    setSlotNotices(prev => prev.map(n => (n.id === noticeId ? { ...n, status } : n)));
    audit('Notice', status === 'Sent' ? 'Confirmed a client message was sent' : 'Marked a client message as failed', { country: x.country, ref: x.clientName, detail: kind === 'standby' ? 'stand-by' : 'papers reminder' });
  }
  function assign(x: SlotRequest, staffId: string) {
    setSlotWaiting(prev => prev.map(r => (r.id === x.id ? { ...r, assignedTo: staffId } : r)));
    audit('Case', staffId ? 'Changed who looks after a client' : 'Cleared who looks after a client', { country: x.country, ref: x.clientName, detail: team.find(t => t.id === staffId)?.name || '' });
  }

  const action = (x: SlotRequest, kind: 'standby' | 'papers') => {
    const tp = kind === 'standby' ? topic : ptopic;
    const st = sendState(slotNotices, x.id, tp);
    const text = kind === 'standby' ? standbyMessage(x, w) : papersMessage(x, missingItems(x));
    const label = kind === 'standby' ? 'Stand-by message' : 'Ask for papers';
    if (kind === 'standby' && err) return <span className="text-[12px] text-[var(--muted)]" data-testid="slot-sb-action">Set a valid time first</span>;
    return (
      <span className="inline-flex items-center gap-1 flex-wrap" data-testid="slot-sb-action">
        {st.state === 'sent' ? <span className="btn btn-sm" style={{ opacity: .75, cursor: 'default' }} data-testid="slot-sb-done">✓ sent {fmtPkt(st.last!.at)}</span>
          : st.state === 'limit' ? <><span className="btn btn-sm" style={{ opacity: .75, cursor: 'default' }} data-testid="slot-sb-limit">{MAX_ATTEMPTS} tries used</span><a className="btn btn-sm" href={`tel:${x.phone}`} data-testid="slot-sb-call">Call</a></>
            : <a className="btn btn-sm" style={WA_BTN} target="_blank" rel="noreferrer" href={waUrl(x.phone, text)} onClick={() => opened(x, kind)} data-testid="slot-sb-wa" title={`WhatsApp ${x.clientName}`}>
              {label}{st.state !== 'new' ? ` · try ${st.attempts + 1} of ${MAX_ATTEMPTS}` : ''}
            </a>}
        {st.state === 'opened' && st.last && <>
          <button className="btn btn-sm" onClick={() => mark(st.last!.id, x, 'Sent', kind)} data-testid="slot-sb-marksent">Sent ✓</button>
          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => mark(st.last!.id, x, 'Failed', kind)} data-testid="slot-sb-markfailed">Did not go</button>
        </>}
      </span>
    );
  };

  const staff = activeStaff(team);
  const row = (x: SlotRequest, group: 'ready' | 'nearly' | 'not') => {
    const r = readiness(x);
    const d = daysToTravel(x, todayIso);
    const tp = group === 'ready' ? topic : ptopic;
    const state = group === 'ready' && !topic ? 'new' : sendState(slotNotices, x.id, tp).state;
    return (
      <tr key={x.id} data-testid="slot-sb-row" data-client={x.clientName} data-group={group} data-state={state}>
        <td><div className="font-semibold text-[13.5px]">{x.clientName}</div><div className="text-[11.5px] text-[var(--muted)]">{x.applicants} {x.applicants === 1 ? 'person' : 'people'}{x.centre ? ' · ' + x.centre : ''}</div>
          {group === 'ready' && <span className="chip mt-1" style={nowIds.has(x.id) ? TONE.good : TONE.neutral} data-testid="slot-sb-cap" data-cap={nowIds.has(x.id) ? 'now' : 'later'}>{nowIds.has(x.id) ? 'This opening' : 'Next opening'}</span>}</td>
        <td className="text-[12.5px]"><span className="chip" style={x.priority === 'Urgent' ? TONE.bad : x.priority === 'Flexible' ? TONE.neutral : TONE.info}>{x.priority}</span>{d !== null && <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{d < 0 ? 'travel date passed' : `travels in ${d} day${d === 1 ? '' : 's'}`}</div>}</td>
        <td className="text-[12.5px]"><span className="chip" style={group === 'ready' ? TONE.good : group === 'nearly' ? TONE.warn : TONE.bad} data-testid="slot-sb-ready-chip">{r.done}/{r.total}</span>
          {group !== 'ready' && <div className="text-[11.5px] text-[var(--muted)] mt-0.5" data-testid="slot-sb-missing">Missing: {missingItems(x).join(', ')}</div>}</td>
        <td>{group === 'ready'
          ? <select value={x.assignedTo || ''} onChange={e => assign(x, e.target.value)} style={{ width: 150 }} data-testid="slot-sb-assign"><option value="">— nobody yet —</option>{staff.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          : <span className="text-[12px] text-[var(--muted)]">{team.find(t => t.id === x.assignedTo)?.name || '—'}</span>}</td>
        <td>{group === 'ready' && !nowIds.has(x.id) && sendState(slotNotices, x.id, topic).state === 'new'
          ? <span className="text-[12px] text-[var(--muted)]" data-testid="slot-sb-held">Kept for the next opening</span>
          : action(x, group === 'ready' ? 'standby' : 'papers')}</td>
      </tr>
    );
  };
  const table = (list: SlotRequest[], group: 'ready' | 'nearly' | 'not', title: string, sub: string, tid: string) => list.length > 0 && (
    <div className="mt-4">
      <Panel title={title} subtitle={sub} flush testid={tid}>
        <div className="overflow-auto"><table style={{ minWidth: 820, tableLayout: 'fixed' }} className="cells-top">
          <colgroup><col style={{ width: '21%' }} /><col style={{ width: '14%' }} /><col style={{ width: '28%' }} /><col style={{ width: '17%' }} /><col style={{ width: '20%' }} /></colgroup>
          <thead><tr><th>Client</th><th>Priority</th><th>Papers</th><th>Guided by</th><th>Message</th></tr></thead>
          <tbody>{list.map(x => row(x, group))}</tbody>
        </table></div>
      </Panel>
    </div>
  );

  return (
    <div data-testid="slot-standby">
      <Callout tone="info" title="Be ready before dates open — nobody can know the exact minute">
        None of the five providers gives advance notice of release times, so the portal cannot tell you when dates will open. What it can do is make sure that, at the likely time, the clients who are ready have their phone and passport beside them and enough staff are on the call. Every client books in their own name: they do the live selfie and enter the SMS code themselves, and the team guides. Nothing is held for later and nothing is booked in bulk.
      </Callout>

      <div className="mt-4">
        <Panel title="The time to be ready for" subtitle="Pakistan time. Fill it from an official notice, or from the pattern on the Results tab (that one is only an estimate)." testid="slot-sb-window">
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <Field label="Country"><select value={w.country} onChange={e => changeCountry(e.target.value)} data-testid="slot-sb-country">{COUNTRY_CHOICES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Centre / city (optional)"><input value={w.centre} onChange={e => change({ centre: e.target.value })} placeholder="e.g. Islamabad" data-testid="slot-sb-centre" /></Field>
            <Field label="How sure is this time?"><select value={w.basis} onChange={e => change({ basis: e.target.value as StandbyBasis })} data-testid="slot-sb-basis">{STANDBY_BASIS.map(b => <option key={b}>{b}</option>)}</select></Field>
            <Field label="Date"><input type="date" value={w.date} onChange={e => change({ date: e.target.value })} data-testid="slot-sb-date" /></Field>
            <Field label="Time"><input type="time" value={w.time} onChange={e => change({ time: e.target.value })} data-testid="slot-sb-time" /></Field>
            <Field label="Clients one staff member can guide at once"><select value={per} onChange={e => { const n = Number(e.target.value); setPer(n); save(w, n, people); }} data-testid="slot-sb-per">{PER_STAFF_CHOICES.map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="People on the call at that time"><select value={people} onChange={e => { const n = Number(e.target.value); setPeople(n); save(w, per, n); }} data-testid="slot-sb-people"><option value={0}>From the rota ({autoPeople})</option>{PEOPLE_CHOICES.map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button className="btn btn-sm" disabled={!hasNext} onClick={useNext} data-testid="slot-sb-usenext" title="Fill in the next opening already entered under Release times & rota">Use the next opening I entered</button>
            {!err && <span className="text-[13px]" data-testid="slot-sb-when">Be ready for <b>{whenLabel(w)}</b> (Pakistan time) · {w.basis === 'Official notice' ? 'official notice' : 'our own estimate'}</span>}
          </div>
          {err && <div className="mt-3"><Callout tone="warn"><span data-testid="slot-sb-error">{err}</span></Callout></div>}
        </Panel>
      </div>

      <div className="grid gap-3.5 mt-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Ready to book" value={plan.ready.length} hint="all six papers done" color="var(--green)" icon="appraisal" testid="slot-sb-n-ready" />
        <StatCard label="Nearly ready" value={plan.nearly.length} hint="one or two papers missing" color="var(--gold)" icon="attendance" testid="slot-sb-n-nearly" />
        <StatCard label="Not ready" value={plan.notReady.length} hint="cannot be booked yet" color="var(--red)" icon="complaints" testid="slot-sb-n-not" />
        <StatCard label="Told" value={`${told} / ${plan.ready.length}`} hint="ready clients who got the message" icon="appointments" testid="slot-sb-n-told" />
      </div>

      {all.length === 0 && <div className="mt-4"><EmptyState title={`Nobody is waiting for ${w.country}`} body="Add clients on the Waiting list tab, then come back here before the likely opening time." /></div>}

      {plan.ready.length > 0 && (
        <div className="mt-4">
          <Panel title="Staff for this opening" subtitle={`At ${per} clients each, ${plan.ready.length} ready client${plan.ready.length === 1 ? '' : 's'} need ${plan.staffNeeded} staff on the call.`} testid="slot-sb-staff">
            <div className="flex gap-6 flex-wrap text-[13.5px]">
              <div><span className="text-[var(--muted)]">Staff needed</span> <b className="font-mono-ui" data-testid="slot-sb-needed">{plan.staffNeeded}</b></div>
              <div><span className="text-[var(--muted)]">On the rota for this time</span> <b className="font-mono-ui" data-testid="slot-sb-rota">{plan.onRota}</b></div>
              <div><span className="text-[var(--muted)]">Seats at this opening</span> <b className="font-mono-ui" data-testid="slot-sb-seats">{cap.seats}</b> <span className="text-[12px] text-[var(--muted)]">({cap.people} {cap.people === 1 ? 'person' : 'people'} × {cap.perPerson})</span></div>
            </div>
            {cap.later.length > 0 && <div className="mt-2"><Callout tone="info"><span data-testid="slot-sb-later">{cap.later.length} ready {cap.later.length === 1 ? 'client does' : 'clients do'} not fit into this opening. {cap.later.length === 1 ? 'That client is' : 'Those clients are'} kept for the next opening or a cancelled slot, so nobody is told to wait by the phone and then left without help. Raise “People on the call” if more people will be there.</span></Callout></div>}
            {!plan.hasRota && <div className="mt-2"><Callout tone="warn"><span data-testid="slot-sb-norota">No one is on the rota for {w.country} yet — add names under Release times &amp; rota.</span></Callout></div>}
            {plan.hasRota && plan.rotaShort > 0 && <div className="mt-2"><Callout tone="warn"><span data-testid="slot-sb-short">The rota is short by {plan.rotaShort} — ask {plan.rotaShort} more {plan.rotaShort === 1 ? 'person' : 'people'} to be on the call, or ready clients will wait.</span></Callout></div>}
            <div className="flex gap-2 flex-wrap mt-3" data-testid="slot-sb-load">
              {plan.load.map(l => <span key={l.id} className="chip" style={l.over ? TONE.bad : TONE.good} data-testid="slot-sb-load-chip" data-name={l.name} title={l.over ? `More than ${per} at once` : ''}>{l.name} · {l.count}{l.over ? ' — too many' : ''}</span>)}
              {plan.unassigned > 0 && <span className="chip" style={TONE.warn} data-testid="slot-sb-unassigned">{plan.unassigned} with nobody yet — choose a staff member below</span>}
            </div>
          </Panel>
        </div>
      )}

      {table(plan.ready, 'ready', 'Ready to book', 'Most urgent first. Send each client the stand-by message and choose who stays on the call with them.', 'slot-sb-t-ready')}
      {example && !err && (
        <details className="mt-3 text-[13px]"><summary className="cursor-pointer" style={{ color: 'var(--accent-ink)' }}>See the message clients get</summary>
          <div className="mt-2 p-3 rounded-xl text-[13px] leading-relaxed" style={{ background: '#F7F7F5', whiteSpace: 'pre-wrap' }} data-testid="slot-sb-preview">{standbyMessage(example, w)}</div>
        </details>
      )}
      {table(plan.nearly, 'nearly', 'Nearly ready', 'One or two papers are missing. Finish these first and they can join the ready list.', 'slot-sb-t-nearly')}
      {table(plan.notReady, 'not', 'Not ready yet', 'These clients cannot be booked on the day. Ask for the missing papers now.', 'slot-sb-t-not')}
    </div>
  );
}
