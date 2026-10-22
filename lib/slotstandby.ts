import type { SlotAlert, SlotRequest, SlotRelease, TeamMember } from './types';
import { READINESS_ITEMS, clock12, countryMatches, isWaiting, nextOpening, pktDow, pktToMs, readiness, sortWaiting } from './slotdesk';

// Stand-by: the hour before dates are likely to open. Pure planning helpers — nothing here talks to any
// website. The tab built on these lists who is ready to book, who still needs papers, how many staff the
// list needs, and what to tell each client. Each client books in their own name (their own live selfie
// and SMS code); the team only guides.

export const STANDBY_BASIS = ['Our estimate', 'Official notice'] as const;
export type StandbyBasis = (typeof STANDBY_BASIS)[number];
export interface StandbyWindow { country: string; centre: string; date: string; time: string; basis: StandbyBasis }

export const PER_STAFF_CHOICES = [2, 3, 4, 5] as const;
export const DEFAULT_PER_STAFF = 3;
/** How long after the start time a window is still worth planning (people are still booking). */
export const WINDOW_GRACE_MIN = 60;

const norm = (s: string) => (s || '').trim().toLowerCase();
const pad2 = (t: string) => (/^\d:\d{2}$/.test(t) ? '0' + t : t);

/** '' when the window is usable, otherwise what is wrong with it. */
export function windowError(w: StandbyWindow, nowMs: number): string {
  if (!w.country) return 'Pick the country.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date || '') || !/^\d{1,2}:\d{2}$/.test(w.time || '')) return 'Enter the date and the time (Pakistan time).';
  const ms = pktToMs(w.date, w.time);
  if (!Number.isFinite(ms)) return 'That date or time is not valid.';
  if (ms + WINDOW_GRACE_MIN * 60000 < nowMs) return 'That time has already passed — pick the next likely time.';
  return '';
}

/** One topic for one window, so a client told about it is never told twice (and a failed try can be repeated). */
export const standbyTopic = (w: StandbyWindow) => `standby|${w.country}|${norm(w.centre)}|${w.date}|${pad2(w.time)}`;
/** Papers reminders are kept once per client per day. */
export const papersTopic = (todayIso: string) => `papers|${todayIso}`;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Wednesday 21 Oct, 3:00 pm" */
export function whenLabel(w: Pick<StandbyWindow, 'date' | 'time'>): string {
  const d = new Date(w.date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '—';
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${clock12(pad2(w.time))}`;
}

export function missingItems(x: Pick<SlotRequest, 'ready'>): string[] {
  const have = new Set(x.ready || []);
  return READINESS_ITEMS.filter(i => !have.has(i));
}

/** The message that gets a ready client to keep their phone and time free. It promises nothing. */
export function standbyMessage(x: SlotRequest, w: StandbyWindow): string {
  const first = x.clientName.split(' ')[0];
  const where = `${w.country}${w.centre ? ' ' + w.centre : ''}`;
  const when = whenLabel(w);
  const lead = w.basis === 'Official notice'
    ? `The official notice says new ${where} appointment dates open on ${when} (Pakistan time).`
    : `${where} appointment dates may open around ${when} (Pakistan time). This is our own estimate, not an announcement.`;
  return `Assalam o Alaikum ${first}, ${lead} Please be free from 30 minutes before, with your phone beside you (the centre sends a code by SMS) and your passport nearby. You will do the live selfie and enter the code yourself while we stay on the call and guide you step by step. We cannot promise a date — the centre decides how many dates it opens.`;
}

/** Asks a client who is not ready for exactly the papers still missing. */
export function papersMessage(x: SlotRequest, missing: string[]): string {
  const first = x.clientName.split(' ')[0];
  const list = missing.length ? missing.map(m => `• ${m}`).join('\n') : '• (nothing missing)';
  return `Assalam o Alaikum ${first}, before the ${x.country} dates open we still need these from you:\n${list}\nPlease send or finish them as soon as you can — a client whose papers are not complete cannot be booked on the day.`;
}

export interface StaffLoad { id: string; name: string; count: number; over: boolean }
export interface StandbyPlan {
  ready: SlotRequest[]; nearly: SlotRequest[]; notReady: SlotRequest[];
  staffNeeded: number; load: StaffLoad[]; unassigned: number;
  onRota: number; rotaShort: number; hasRota: boolean;
}

/** Everyone waiting for this country (and centre, when both are filled in), most urgent first. */
export function matchWindow(list: SlotRequest[], w: Pick<StandbyWindow, 'country' | 'centre'>): SlotRequest[] {
  return sortWaiting(list.filter(x => isWaiting(x) && countryMatches(x.country, w.country) && (!w.centre || !x.centre || norm(x.centre) === norm(w.centre))));
}

const isActive = (t: TeamMember) => t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave';

export function standbyPlan(list: SlotRequest[], w: StandbyWindow, perStaff: number, team: TeamMember[], releases: SlotRelease[]): StandbyPlan {
  const per = Math.max(1, Math.floor(perStaff) || DEFAULT_PER_STAFF);
  const all = matchWindow(list, w);
  const ready: SlotRequest[] = [], nearly: SlotRequest[] = [], notReady: SlotRequest[] = [];
  for (const x of all) { const r = readiness(x).label; (r === 'Ready' ? ready : r === 'Almost ready' ? nearly : notReady).push(x); }

  const counts = new Map<string, number>();
  let unassigned = 0;
  for (const x of ready) { if (x.assignedTo && team.some(t => t.id === x.assignedTo)) counts.set(x.assignedTo, (counts.get(x.assignedTo) || 0) + 1); else unassigned++; }
  const load: StaffLoad[] = [...counts.entries()]
    .map(([id, count]) => ({ id, name: team.find(t => t.id === id)?.name || '', count, over: count > per }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const staffNeeded = ready.length ? Math.ceil(ready.length / per) : 0;
  const mine = releases.filter(r => r.active && countryMatches(r.country, w.country) && (!r.centre || !w.centre || norm(r.centre) === norm(w.centre)));
  const sameTime = mine.filter(r => pad2(r.time) === pad2(w.time));
  const rotaIds = new Set<string>();
  for (const r of (sameTime.length ? sameTime : mine)) for (const id of r.rota || []) if (team.some(t => t.id === id && isActive(t))) rotaIds.add(id);
  const onRota = rotaIds.size;
  return { ready, nearly, notReady, staffNeeded, load, unassigned, onRota, rotaShort: Math.max(0, staffNeeded - onRota), hasRota: mine.some(r => (r.rota || []).length > 0) };
}

/** The soonest opening already entered for this country (an official time or our estimate) — used to fill the window in. */
export function windowFromReleases(releases: SlotRelease[], country: string, nowMs: number): StandbyWindow | null {
  let best: { r: SlotRelease; whenMs: number; dateIso: string; time: string } | null = null;
  for (const r of releases) {
    if (!countryMatches(r.country, country)) continue;
    const n = nextOpening(r, nowMs); if (!n) continue;
    if (!best || n.whenMs < best.whenMs) best = { r, whenMs: n.whenMs, dateIso: n.dateIso, time: n.time };
  }
  if (!best) return null;
  return { country, centre: best.r.centre || '', date: best.dateIso, time: pad2(best.time), basis: best.r.basis === 'Official notice' ? 'Official notice' : 'Our estimate' };
}

/**
 * "Official notice" may only be used when an official notice for exactly this country, date and time is on file
 * (a confirmed alert, or a release time saved as an official notice). Otherwise the message would claim more than we know.
 */
export function hasOfficialSource(w: StandbyWindow, releases: SlotRelease[], alerts: SlotAlert[]): boolean {
  const t = pad2(w.time);
  const fromAlert = alerts.some(a => countryMatches(a.country, w.country) && a.verification === 'Official notice' && a.opensDate === w.date && pad2(a.opensTime || '') === t);
  const fromRelease = releases.some(r => r.active && r.basis === 'Official notice' && countryMatches(r.country, w.country) && pad2(r.time) === t
    && (r.oneOffDate ? r.oneOffDate === w.date : (r.days || []).includes(pktDow(w.date))));
  return fromAlert || fromRelease;
}
export function basisError(w: StandbyWindow, releases: SlotRelease[], alerts: SlotAlert[]): string {
  if (w.basis !== 'Official notice') return '';
  return hasOfficialSource(w, releases, alerts) ? '' : 'No official notice is on file for this date and time. Log it under Alerts (with its link) first, or choose “Our estimate”.';
}

// ---------- how many can be guided at once (the "this opening / next opening" split) ----------
export const PEOPLE_CHOICES = [1, 2, 3, 4, 5, 6] as const;
export interface Capacity {
  people: number; perPerson: number; seats: number;
  now: SlotRequest[];       // ready clients who fit into this opening, most urgent first
  later: SlotRequest[];     // ready clients kept for the next opening or a cancellation
}
/** One person guiding three clients at a time means three seats; the rest wait for the next opening. Order is kept. */
export function capacityFor(ready: SlotRequest[], perStaff: number, people: number): Capacity {
  const perPerson = Math.max(1, Math.floor(perStaff) || DEFAULT_PER_STAFF);
  const p = Math.max(1, Math.floor(people) || 1);
  const seats = perPerson * p;
  return { people: p, perPerson, seats, now: ready.slice(0, seats), later: ready.slice(seats) };
}
