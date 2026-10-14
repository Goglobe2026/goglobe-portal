import type { Case, Appointment, PlanPart, PlanTrigger } from './types';
import { caseCharge, casePaid, closedOn, daysBetween, shiftMonth, monthLabel } from './finance';
import { allocateParts } from './planCore';
import { phoneKey } from './leadImport';

// ---------------------------------------------------------------------------
// Payment plans
//
// Clients in this business pay in parts: half now, the rest at the embassy
// appointment or when the file is collected. A plan lists those parts. The
// money actually received on the file (which is how every payment is already
// recorded, from any screen) fills the OLDEST unpaid part first, so the next
// payment always lands on the next part — nobody has to say which one.
// ---------------------------------------------------------------------------

export const TRIGGER_LABEL: Record<PlanTrigger, string> = {
  now: 'Paid up front',
  date: 'On a set date',
  appointment: 'At the embassy appointment',
  collection: 'When the file / passport is collected',
  decision: 'After the visa decision',
};
const WAITING_FOR: Record<PlanTrigger, string> = {
  now: 'Due as soon as the file opens',
  date: 'No date set',
  appointment: 'Waiting for the appointment to be booked',
  collection: 'Waiting for a collection date',
  decision: 'Waiting for the visa decision',
};

export type PartStatus = 'Paid' | 'Overdue' | 'Due soon' | 'Scheduled' | 'Waiting';
export interface PartView {
  id: string; index: number; label: string; trigger: PlanTrigger;
  planAmount: number;      // what the plan says
  amount: number;          // what counts: never more than the fee leaves room for
  paid: number; remaining: number;
  due: string;             // the date it falls due ('' = not known yet)
  dueFrom: 'set' | 'appointment' | 'opened' | '';  // where that date came from
  status: PartStatus;
  waitingFor: string;
  virtual?: boolean;       // the part of the fee the plan does not cover
}
export interface PlanView {
  parts: PartView[];
  charge: number; paid: number; outstanding: number; planned: number;
  unscheduled: number;     // fee the plan leaves out
  overplanned: number;     // plan adds up to more than the fee
  next: PartView | null;   // first part with money still owed
  overdueAmount: number; dueSoonAmount: number;
}

export const SOON_DAYS = 7;

// The date of this client's embassy appointment: the next one still ahead,
// otherwise the most recent one. Matched by phone number, then by name.
export function appointmentDateFor(c: Pick<Case, 'phone' | 'name'>, appts: Appointment[], todayIso: string): string {
  const key = phoneKey(c.phone);
  const mine = appts.filter(a => a.date && a.status !== 'Missed' && ((key && phoneKey(a.phone) === key) || (!key && a.clientName.trim().toLowerCase() === c.name.trim().toLowerCase())));
  if (!mine.length) return '';
  const ahead = mine.filter(a => a.date >= todayIso).map(a => a.date).sort();
  if (ahead.length) return ahead[0];
  return mine.map(a => a.date).sort().pop() || '';
}

function statusOf(remaining: number, due: string, todayIso: string): PartStatus {
  if (remaining <= 0) return 'Paid';
  if (!due) return 'Waiting';
  if (due < todayIso) return 'Overdue';
  return daysBetween(todayIso, due) <= SOON_DAYS ? 'Due soon' : 'Scheduled';
}

// The plan as it stands: each part with what it has received and when it falls due.
// `paidOverride` lets the month-end closing ask "as at the last day of the month".
export function computePlan(c: Case, appts: Appointment[], todayIso: string, paidOverride?: number): PlanView | null {
  if (!c.plan || !c.plan.length) return null;
  const charge = caseCharge(c);
  const paid = paidOverride ?? casePaid(c);
  // Never plan more than the fee leaves room for (a discount may have been given later).
  let room = charge;
  const eff = c.plan.map(p => { const a = Math.min(Math.max(0, p.amount), room); room -= a; return a; });
  const planned = eff.reduce((s, a) => s + a, 0);
  const planTotal = c.plan.reduce((s, p) => s + Math.max(0, p.amount), 0);
  const unscheduled = Math.max(0, charge - planTotal);
  const amounts = unscheduled > 0 ? [...eff, unscheduled] : eff;
  const { shares } = allocateParts(amounts, paid);

  const apptDate = c.plan.some(p => p.trigger === 'appointment' && !p.dueDate) ? appointmentDateFor(c, appts, todayIso) : '';
  const parts: PartView[] = c.plan.map((p, i) => {
    let due = ''; let dueFrom: PartView['dueFrom'] = '';
    if (p.dueDate) { due = p.dueDate; dueFrom = 'set'; }
    else if (p.trigger === 'now') { due = closedOn(c); dueFrom = 'opened'; }
    else if (p.trigger === 'appointment' && apptDate) { due = apptDate; dueFrom = 'appointment'; }
    const sh = shares[i];
    return {
      id: p.id, index: i, label: p.label || `Part ${i + 1}`, trigger: p.trigger, planAmount: p.amount, amount: eff[i],
      paid: sh.paid, remaining: sh.remaining, due, dueFrom, status: statusOf(sh.remaining, due, todayIso), waitingFor: WAITING_FOR[p.trigger],
    };
  });
  if (unscheduled > 0) {
    const sh = shares[shares.length - 1];
    parts.push({
      id: '__rest', index: parts.length, label: 'Rest of the fee (not in the plan)', trigger: 'date', planAmount: unscheduled, amount: unscheduled,
      paid: sh.paid, remaining: sh.remaining, due: '', dueFrom: '', status: statusOf(sh.remaining, '', todayIso), waitingFor: 'Not scheduled yet', virtual: true,
    });
  }
  const next = parts.find(p => p.remaining > 0) || null;
  return {
    parts, charge, paid, outstanding: Math.max(0, charge - paid), planned, unscheduled, overplanned: Math.max(0, planTotal - charge), next,
    overdueAmount: parts.filter(p => p.status === 'Overdue').reduce((s, p) => s + p.remaining, 0),
    dueSoonAmount: parts.filter(p => p.status === 'Due soon').reduce((s, p) => s + p.remaining, 0),
  };
}

// ---------------------------------------------------------------------------
// What is still owed on a file, as a list of chunks with dates — the same
// shape whether or not the file has a plan (no plan = one chunk, dated by the
// promised date, if any).
// ---------------------------------------------------------------------------
export interface Chunk { caseId: string; label: string; remaining: number; due: string; status: PartStatus; waitingFor: string; part?: number }
export type DueState = 'Overdue' | 'Due this week' | 'Promised' | 'No date set' | 'Settled';
export interface CaseDue {
  chunks: Chunk[]; outstanding: number; overdue: number; dueSoon: number;
  state: DueState; next: Chunk | null; nextDue: string; plan: PlanView | null;
}

export function caseDue(c: Case, appts: Appointment[], todayIso: string, paidOverride?: number): CaseDue {
  const plan = computePlan(c, appts, todayIso, paidOverride);
  let chunks: Chunk[];
  if (plan) {
    chunks = plan.parts.filter(p => p.remaining > 0).map(p => ({ caseId: c.id, label: p.label, remaining: p.remaining, due: p.due, status: p.status, waitingFor: p.waitingFor, part: p.index }));
  } else {
    const rem = Math.max(0, caseCharge(c) - (paidOverride ?? casePaid(c)));
    const due = c.expectedPaymentDate || '';
    chunks = rem > 0 ? [{ caseId: c.id, label: 'Balance', remaining: rem, due, status: statusOf(rem, due, todayIso), waitingFor: 'No date promised' }] : [];
  }
  const outstanding = chunks.reduce((s, x) => s + x.remaining, 0);
  const overdue = chunks.filter(x => x.status === 'Overdue').reduce((s, x) => s + x.remaining, 0);
  const dueSoon = chunks.filter(x => x.status === 'Due soon').reduce((s, x) => s + x.remaining, 0);
  const state: DueState = !chunks.length ? 'Settled'
    : chunks.some(x => x.status === 'Overdue') ? 'Overdue'
    : chunks.some(x => x.status === 'Due soon') ? 'Due this week'
    : chunks.some(x => x.status === 'Scheduled') ? 'Promised' : 'No date set';
  const next = chunks[0] || null;
  const dated = chunks.filter(x => x.due).map(x => x.due).sort();
  return { chunks, outstanding, overdue, dueSoon, state, next, nextDue: dated[0] || '', plan };
}

// ---------------------------------------------------------------------------
// Collection forecast: what falls due when
// ---------------------------------------------------------------------------
export interface ForecastBucket { key: string; label: string; amount: number; files: number; chunks: (Chunk & { name: string })[] }
export interface Forecast { overdue: ForecastBucket; months: ForecastBucket[]; later: ForecastBucket; undated: ForecastBucket; total: number }

// `inclusive`: money due ON the as-at date already counts as due (used for a
// month-end, when the last day of the month is over). The buckets then start
// from the following month.
export function forecast(items: { c: Case; paid?: number }[], appts: Appointment[], asOf: string, opts: { monthsAhead?: number; inclusive?: boolean } = {}): Forecast {
  const monthsAhead = opts.monthsAhead ?? 3; const inclusive = !!opts.inclusive;
  const first = shiftMonth(asOf.slice(0, 7), inclusive ? 1 : 0);
  const mk = (key: string, label: string): ForecastBucket => ({ key, label, amount: 0, files: 0, chunks: [] });
  const overdue = mk('overdue', 'Overdue'), later = mk('later', 'Later'), undated = mk('undated', 'No date yet');
  const months: ForecastBucket[] = Array.from({ length: monthsAhead }, (_, i) => { const m = shiftMonth(first, i); return mk(m, monthLabel(m)); });
  const seen = new Map<ForecastBucket, Set<string>>();
  const put = (b: ForecastBucket, x: Chunk, name: string) => {
    b.amount += x.remaining; b.chunks.push({ ...x, name });
    const s = seen.get(b) || seen.set(b, new Set()).get(b)!; s.add(x.caseId); b.files = s.size;
  };
  let total = 0;
  for (const it of items) {
    const cd = caseDue(it.c, appts, asOf, it.paid);
    for (const x of cd.chunks) {
      total += x.remaining;
      if (!x.due) { put(undated, x, it.c.name); continue; }
      const past = inclusive ? x.due <= asOf : x.due < asOf;
      if (past) { put(overdue, x, it.c.name); continue; }
      const b = months.find(m => m.key === x.due.slice(0, 7));
      put(b || later, x, it.c.name);
    }
  }
  return { overdue, months, later, undated, total };
}

// ---------------------------------------------------------------------------
// Building and checking a plan
// ---------------------------------------------------------------------------
export type PresetKind = 'half-appointment' | 'half-collection' | 'half-decision' | 'three-parts';
export const PRESET_LABEL: Record<PresetKind, string> = {
  'half-appointment': 'Half now, half at the appointment',
  'half-collection': 'Half now, half at file collection',
  'half-decision': 'Half now, half after the decision',
  'three-parts': 'Three parts: now, appointment, collection',
};

export function presetPlan(kind: PresetKind, total: number, newId: () => string): PlanPart[] {
  const t = Math.max(0, Math.round(total));
  if (kind === 'three-parts') {
    const a = Math.round(t * 0.4), b = Math.round(t * 0.3);
    return [
      { id: newId(), label: 'Advance', amount: a, trigger: 'now' },
      { id: newId(), label: 'At appointment', amount: b, trigger: 'appointment' },
      { id: newId(), label: 'On file collection', amount: t - a - b, trigger: 'collection' },
    ];
  }
  const half = Math.round(t / 2);
  const second: Record<string, [string, PlanTrigger]> = {
    'half-appointment': ['At appointment', 'appointment'],
    'half-collection': ['On file collection', 'collection'],
    'half-decision': ['After the visa decision', 'decision'],
  };
  const [label, trigger] = second[kind];
  return [
    { id: newId(), label: 'Advance', amount: half, trigger: 'now' },
    { id: newId(), label, amount: t - half, trigger },
  ];
}

// Things to fix before a plan can be saved.
export function planProblems(plan: PlanPart[]): string[] {
  const out: string[] = [];
  plan.forEach((p, i) => {
    const n = p.label?.trim() || `Part ${i + 1}`;
    if (!(Number(p.amount) > 0)) out.push(`${n}: enter an amount above zero`);
    if (p.trigger === 'date' && !p.dueDate) out.push(`${n}: choose the date`);
  });
  return out;
}

// Make the plan add up to the fee by changing the last part.
export function fitLastPart(plan: PlanPart[], charge: number): PlanPart[] {
  if (!plan.length) return plan;
  const others = plan.slice(0, -1).reduce((s, p) => s + Math.max(0, Number(p.amount) || 0), 0);
  const last = plan[plan.length - 1];
  return [...plan.slice(0, -1), { ...last, amount: Math.max(0, Math.round(charge - others)) }];
}

export const STATUS_COLOR: Record<PartStatus, string> = {
  Paid: '#0B6E4F', Overdue: '#B5433A', 'Due soon': '#8a5a12', Scheduled: '#1F6E8C', Waiting: '#5B6270',
};

const niceDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
// "At appointment — PKR 50,000, due 20 Nov"
export function describeChunk(x: Chunk): string {
  const amt = 'PKR ' + Math.round(x.remaining).toLocaleString('en-US');
  return `${x.label} — ${amt}${x.due ? `, ${x.status === 'Overdue' ? 'was due' : 'due'} ${niceDate(x.due)}` : `, ${x.waitingFor.toLowerCase()}`}`;
}
