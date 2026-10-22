import type { SlotRequest, SlotRelease, SlotAttempt, TeamMember, FamilyMember, SlotLive } from './types';

// ---------------------------------------------------------------------------
// Slot Desk — the maths behind the screen. Plain functions, no network.
//
// This is a planning tool for the team: who is waiting for an appointment, when
// the centre says new dates open, who is on duty at that moment, what happened,
// and what the extra fees paid to middlemen add up to. It never talks to a visa
// website; people book on the official site themselves.
//
// All times are Pakistan time (UTC+5, no daylight saving).
// ---------------------------------------------------------------------------

const PKT_MS = 5 * 3600 * 1000;
export const GRACE_MIN = 30;          // a release counts as "open now" for this long

// The 29 Schengen states, as separate countries — each one has its own provider, rules and opening times.
export const PRIORITY_COUNTRIES = ['Spain', 'Belgium', 'Norway'];
export const SCHENGEN_COUNTRIES = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Italy', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland'];
const NON_SCHENGEN = ['UK', 'USA', 'Canada', 'Australia', 'Türkiye', 'New Zealand', 'UAE', 'Malaysia', 'Saudi Arabia', 'Azerbaijan', 'Morocco'];
/** What the country pickers offer: the three priority countries, the other Schengen states, then everywhere else. */
export const SLOT_COUNTRIES: string[] = [...PRIORITY_COUNTRIES, ...SCHENGEN_COUNTRIES.filter(c => !PRIORITY_COUNTRIES.includes(c)), 'Schengen', ...NON_SCHENGEN];
/** Same country — and the old catch-all "Schengen" matches any Schengen state, so earlier entries keep working. */
export function countryMatches(a: string, b: string): boolean {
  if (a === b) return true;
  return (a === 'Schengen' && SCHENGEN_COUNTRIES.includes(b)) || (b === 'Schengen' && SCHENGEN_COUNTRIES.includes(a));
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const HOW_BOOKED = ['Client booked, we guided', 'Our team on the official site', 'Paid middleman', 'Other'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-15" + "15:30" in Pakistan time → a real timestamp. */
export function pktToMs(dateIso: string, hhmm: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const [hh, mm] = (hhmm || '00:00').split(':').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0) - PKT_MS;
}
/** Today's date in Pakistan for any timestamp. */
export function pktDate(ms: number): string {
  const d = new Date(ms + PKT_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function pktDow(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function addDaysIso(dateIso: string, n: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export interface NextOpening {
  releaseId: string; whenMs: number; dateIso: string; time: string;
  state: 'open' | 'upcoming'; msUntil: number;       // msUntil is negative while "open now"
}

/** The next time this release is expected to open (or the one that opened within the last 30 minutes). */
export function nextOpening(r: SlotRelease, nowMs: number): NextOpening | null {
  if (!r.active || !/^\d{1,2}:\d{2}$/.test(r.time || '')) return null;
  const today = pktDate(nowMs);
  const candidates: string[] = [];
  if (r.oneOffDate) candidates.push(r.oneOffDate);
  else if (r.days && r.days.length) for (let i = -1; i <= 14; i++) { const d = addDaysIso(today, i); if (r.days.includes(pktDow(d))) candidates.push(d); }
  for (const d of candidates) {
    const ms = pktToMs(d, r.time);
    if (ms + GRACE_MIN * 60000 > nowMs) return { releaseId: r.id, whenMs: ms, dateIso: d, time: r.time, state: ms <= nowMs ? 'open' : 'upcoming', msUntil: ms - nowMs };
  }
  return null;
}

/** The soonest opening across all the active releases. */
export function soonestOpening(releases: SlotRelease[], nowMs: number): { release: SlotRelease; next: NextOpening } | null {
  let best: { release: SlotRelease; next: NextOpening } | null = null;
  for (const r of releases) {
    const n = nextOpening(r, nowMs); if (!n) continue;
    if (!best || n.whenMs < best.next.whenMs) best = { release: r, next: n };
  }
  return best;
}

export function countdown(ms: number): string {
  if (ms <= 0) return 'open now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(sec)}s`;
}

export function clock12(hhmm: string): string {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m || 0)} ${h >= 12 ? 'pm' : 'am'}`;
}
export function dayLabel(r: SlotRelease): string {
  if (r.oneOffDate) return new Date(r.oneOffDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (!r.days?.length) return 'No days chosen';
  if (r.days.length === 7) return 'Every day';
  const order = [1, 2, 3, 4, 5, 6, 0];
  const set = order.filter(d => r.days.includes(d));
  if (set.join() === '1,2,3,4,5') return 'Monday to Friday';
  return set.map(d => DAY_NAMES[d]).join(', ');
}

// ---------- the waiting list ----------
const PRIO: Record<string, number> = { Urgent: 0, Normal: 1, Flexible: 2 };
export function sortWaiting(list: SlotRequest[]): SlotRequest[] {
  return [...list].sort((a, b) =>
    (PRIO[a.priority] ?? 1) - (PRIO[b.priority] ?? 1)
    || (a.travelBy || '9999').localeCompare(b.travelBy || '9999')
    || (a.createdAt || '').localeCompare(b.createdAt || '')
    || a.clientName.localeCompare(b.clientName));
}
export const isWaiting = (r: SlotRequest) => r.status === 'Waiting';

/** How many days until the client must travel (null if no date). */
export function daysToTravel(r: SlotRequest, todayIso: string): number | null {
  if (!r.travelBy) return null;
  return Math.round((Date.parse(r.travelBy + 'T00:00:00Z') - Date.parse(todayIso + 'T00:00:00Z')) / 86400000);
}

/** Clients that match a release (same country; same centre if both are filled in). */
export function waitingFor(r: SlotRelease, list: SlotRequest[]): SlotRequest[] {
  return sortWaiting(list.filter(x => isWaiting(x) && countryMatches(x.country, r.country) && (!r.centre || !x.centre || x.centre.toLowerCase() === r.centre.toLowerCase())));
}

// ---------- results ----------
export interface ResultStats { attempts: number; got: number; hitRate: number | null; slots: number; avgSlots: number | null }
export function resultStats(log: SlotAttempt[], releaseId?: string): ResultStats {
  const rows = log.filter(l => !releaseId || l.releaseId === releaseId);
  const got = rows.filter(l => l.outcome === 'Got slots');
  const slots = got.reduce((s, l) => s + (l.slotsGot || 0), 0);
  return { attempts: rows.length, got: got.length, hitRate: rows.length ? Math.round((got.length / rows.length) * 100) : null, slots, avgSlots: got.length ? Math.round((slots / got.length) * 10) / 10 : null };
}

// ---------- what the extra fees add up to ----------
export interface PremiumStats {
  month: string; booked: number; viaMiddleman: number; byUs: number; paid: number; average: number;
  saved: number;                      // what the slots booked by us would have cost through a middleman, at the average
}
export function premiumStats(list: SlotRequest[], month: string): PremiumStats {
  const rows = list.filter(r => r.status === 'Booked' && (r.bookedAt || '').slice(0, 7) === month);
  const mid = rows.filter(r => r.bookedHow === 'Paid middleman');
  const paid = mid.reduce((s, r) => s + (r.premium || 0), 0);
  const average = mid.length ? Math.round(paid / mid.length) : 0;
  const byUs = rows.filter(r => r.bookedHow === 'Client booked, we guided' || r.bookedHow === 'Our team on the official site').length;
  return { month, booked: rows.length, viaMiddleman: mid.length, byUs, paid, average, saved: byUs * average };
}
export function premiumByMonth(list: SlotRequest[], endMonth: string, n = 6): PremiumStats[] {
  const out: PremiumStats[] = [];
  let [y, m] = endMonth.split('-').map(Number);
  for (let i = 0; i < n; i++) { out.unshift(premiumStats(list, `${y}-${pad(m)}`)); m--; if (m === 0) { m = 12; y--; } }
  return out;
}

// ---------- messages (opened in WhatsApp with one tap, never sent automatically) ----------
export function waDigits(phone: string): string {
  return (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92');
}
export function waUrl(phone: string, text: string): string {
  return `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;
}
export function rotaMessage(r: SlotRelease, name: string, n: NextOpening | null, nowMs: number = Date.now()): string {
  const when = n ? `${n.dateIso === pktDate(nowMs) ? 'today' : new Date(n.dateIso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })} at ${clock12(n.time)}` : `at ${clock12(r.time)}`;
  return `Assalam o Alaikum ${name.split(' ')[0]}, you are on duty for the ${r.country}${r.centre ? ' ' + r.centre : ''} appointment opening ${when}. Please be at your desk 10 minutes early with the waiting list open, and send me a message with the result right after. Thank you.`;
}
export function clientReadyMessage(x: SlotRequest, r?: SlotRelease | null): string {
  const first = x.clientName.split(' ')[0];
  const when = r ? ` The ${x.country} dates are expected to open ${dayLabel(r).toLowerCase()} around ${clock12(r.time)}.` : '';
  return `Assalam o Alaikum ${first}, we are watching for your ${x.country} appointment.${when} When it opens please keep your phone with you (the centre sends a code by SMS) and your passport nearby — we will guide you step by step. We cannot promise a date, as the centre decides how many dates it opens.`;
}
export function clientBookedMessage(x: SlotRequest): string {
  const first = x.clientName.split(' ')[0];
  const date = x.slotDate ? new Date(x.slotDate + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
  return `Assalam o Alaikum ${first}, your ${x.country} appointment is booked${date ? ' for ' + date : ''}${x.slotTime ? ' at ' + clock12(x.slotTime) : ''}${x.centre ? ' at ' + x.centre : ''}. Please bring your passport and the documents we prepared. We will remind you the day before.`;
}

// ---------- the booking pack: everything the booking form asks for, ready to copy ----------
export interface PackLine { label: string; value: string }
/** "Passport no: AB123" → {label, value}. A line with no colon is kept whole. Blank lines are dropped. */
export function parseDetails(text: string): PackLine[] {
  return (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(':');
    return i > 0 && i < 40 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : { label: '', value: l };
  }).filter(l => l.value);
}
/** What we already know about the client and the family on the file, then whatever was typed in. */
export function packLines(x: SlotRequest, family: FamilyMember[] = []): PackLine[] {
  const out: PackLine[] = [{ label: 'Name', value: x.clientName }];
  if (x.phone) out.push({ label: 'Phone', value: x.phone });
  out.push({ label: 'Country', value: x.country });
  if (x.centre) out.push({ label: 'Centre', value: x.centre });
  out.push({ label: 'Applicants', value: String(x.applicants || 1) });
  if (x.travelBy) out.push({ label: 'Travel by', value: x.travelBy });
  family.forEach((m, i) => {
    out.push({ label: `Family ${i + 1} — name`, value: m.name });
    if (m.passportNo) out.push({ label: `Family ${i + 1} — passport`, value: m.passportNo });
  });
  return [...out.filter(l => l.value), ...parseDetails(x.details || '')];
}
/** One block of text with all the lines — for pasting into a note or sending to a colleague. */
export function packText(x: SlotRequest, family: FamilyMember[] = []): string {
  return packLines(x, family).map(l => (l.label ? `${l.label}: ${l.value}` : l.value)).join('\n');
}

// ---------- "slots just opened" — one message for the whole team ----------
export function alertMessage(country: string, centre: string, clients: SlotRequest[], max = 5): string {
  const where = `${country}${centre ? ' ' + centre : ''}`;
  const top = clients.slice(0, max);
  const order = top.length ? ` Book in this order:\n${top.map((c, i) => `${i + 1}. ${c.clientName}${c.priority === 'Urgent' ? ' (urgent)' : ''}`).join('\n')}\n` : '';
  return `Slots are open NOW for ${where}. Please go to the official booking site right away.${order}Reply "taking <name>" before you start so two people do not book the same client, and send me the result straight after. Thank you.`;
}

// ---------- when do dates really appear? (from the results the team logs) ----------
export interface PatternBucket { label: string; tries: number; got: number }
export interface OpeningPattern {
  total: number; timed: number; enough: boolean;
  days: PatternBucket[]; windows: PatternBucket[];
  bestDay: PatternBucket | null; bestWindow: PatternBucket | null;
}
export const WINDOW_LABELS = ['12–3 am', '3–6 am', '6–9 am', '9 am–12', '12–3 pm', '3–6 pm', '6–9 pm', '9 pm–12'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MIN_FOR_PATTERN = 5;
export function openingPattern(log: SlotAttempt[]): OpeningPattern {
  const days: PatternBucket[] = DAY_ORDER.map(d => ({ label: DAY_NAMES[d], tries: 0, got: 0 }));
  const windows: PatternBucket[] = WINDOW_LABELS.map(label => ({ label, tries: 0, got: 0 }));
  let timed = 0;
  for (const l of log) {
    const got = l.outcome === 'Got slots' ? 1 : 0;
    if (/^\d{4}-\d{2}-\d{2}$/.test(l.date || '')) { const b = days[DAY_ORDER.indexOf(pktDow(l.date))]; b.tries++; b.got += got; }
    if (/^\d{1,2}:\d{2}$/.test(l.time || '')) { const h = Number((l.time as string).split(':')[0]); if (h >= 0 && h < 24) { const b = windows[Math.floor(h / 3)]; b.tries++; b.got += got; timed++; } }
  }
  const best = (rows: PatternBucket[]) => { const hit = rows.filter(r => r.got > 0).sort((a, b) => b.got - a.got || a.tries - b.tries); return hit[0] || null; };
  return { total: log.length, timed, enough: log.length >= MIN_FOR_PATTERN, days, windows, bestDay: best(days), bestWindow: best(windows) };
}

// ---------- the live booking board ----------
/** Everyone who matters while an opening is on: those still waiting, plus those booked today. */
export function liveBoard(list: SlotRequest[], country: string, centre: string, todayIso: string): SlotRequest[] {
  const match = (x: SlotRequest) => (!country || countryMatches(x.country, country)) && (!centre || !x.centre || x.centre.toLowerCase() === centre.toLowerCase());
  const waiting = sortWaiting(list.filter(x => isWaiting(x) && match(x)));
  const done = list.filter(x => x.status === 'Booked' && x.bookedAt === todayIso && match(x)).sort((a, b) => (a.bookedAt + a.clientName).localeCompare(b.bookedAt + b.clientName));
  return [...waiting, ...done];
}
export interface LiveCounts { ready: number; calling: number; booking: number; noSlot: number; booked: number }
export function liveCounts(board: SlotRequest[]): LiveCounts {
  const c: LiveCounts = { ready: 0, calling: 0, booking: 0, noSlot: 0, booked: 0 };
  for (const x of board) {
    if (x.status === 'Booked') c.booked++;
    else if (x.live === 'Calling') c.calling++;
    else if (x.live === 'Booking') c.booking++;
    else if (x.live === 'No slot') c.noSlot++;
    else c.ready++;
  }
  return c;
}
export const liveLabel = (x: SlotRequest): 'Ready' | 'On the phone' | 'Booking now' | 'No slot' | 'Booked' =>
  x.status === 'Booked' ? 'Booked' : x.live === 'Calling' ? 'On the phone' : x.live === 'Booking' ? 'Booking now' : x.live === 'No slot' ? 'No slot' : 'Ready';
export function liveReset(x: SlotRequest): SlotRequest { return { ...x, live: '' as SlotLive, liveBy: '' }; }
/** The message that gets a ready client onto the booking site while a team member stays with them. */
export function joinNowMessage(x: SlotRequest, who: string): string {
  const first = x.clientName.split(' ')[0];
  const where = `${x.country}${x.centre ? ' ' + x.centre : ''}`;
  return `Assalam o Alaikum ${first}, new ${where} dates are open right now. Please open the official booking site on your phone and log in — keep your passport and the phone that gets the SMS code next to you. ${who ? who + ' is' : 'We are'} with you and will guide you step by step. We cannot promise a date, as it depends on how many dates the centre opened.`;
}

export const staffName = (team: TeamMember[], id: string) => team.find(t => t.id === id)?.name || '';

// ---------- readiness checklist, visa types, duplicate cases ----------
export const READINESS_ITEMS = [
  'Passport valid (6+ months, blank pages)', 'Photos taken', 'Travel insurance', 'Bank and income papers', 'Travel plan and stay booked', 'Application form filled',
] as const;
export const VISA_TYPES = ['Tourist', 'Family / friends visit', 'Business', 'Student', 'Work', 'Medical', 'Other'] as const;

export interface Readiness { done: number; total: number; label: 'Ready' | 'Almost ready' | 'Not ready' }
export function readiness(x: Pick<SlotRequest, 'ready'>): Readiness {
  const total = READINESS_ITEMS.length;
  const done = (x.ready || []).filter(k => (READINESS_ITEMS as readonly string[]).includes(k)).length;
  return { done, total, label: done === total ? 'Ready' : done >= total - 2 ? 'Almost ready' : 'Not ready' };
}

const normName = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const normCentreKey = (s: string) => (s || '').trim().toLowerCase();
/** Someone already waiting for the same country (and centre) with the same phone number or name. */
export function findDuplicateCase(list: SlotRequest[], c: Pick<SlotRequest, 'id' | 'clientName' | 'phone' | 'country' | 'centre'>): SlotRequest | null {
  const phone = waDigits(c.phone);
  return list.find(x => {
    if (x.id === c.id || x.status !== 'Waiting' || !countryMatches(x.country, c.country)) return false;
    if (normCentreKey(x.centre) && normCentreKey(c.centre) && normCentreKey(x.centre) !== normCentreKey(c.centre)) return false;
    return (!!phone && waDigits(x.phone) === phone) || (!!normName(c.clientName) && normName(x.clientName) === normName(c.clientName));
  }) || null;
}

