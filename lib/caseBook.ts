import type { Case, CaseOutlay, Transaction, TeamMember } from './types';
import { caseCharge, casePaid, closedOn, applicantsOf, isFamilyCase, computeMonth, monthLabel, closerOf, CLIENT_PAYMENT_CATEGORIES, caseForTx } from './finance';

// ---------------------------------------------------------------------------
// The case book: query numbers, the month-wise list, the month's finance details
// and the payouts that leave our account for a client's file (embassy / appointment
// fee…). Everything here is plain functions on plain lists so it can be tested on
// its own and used both in the browser and on the server.
// ---------------------------------------------------------------------------

// ---------- query numbers: GG01, GG02, … ----------
export const QUERY_PREFIX = 'GG';
export function formatQueryNo(n: number): string { return `${QUERY_PREFIX}${String(n).padStart(2, '0')}`; }
export function parseQueryNo(q?: string): number | null {
  const m = /^GG(\d+)$/i.exec((q || '').trim());
  return m ? parseInt(m[1], 10) : null;
}
export function nextQueryNumber(cases: Pick<Case, 'queryNo'>[]): number {
  let max = 0;
  for (const c of cases) { const n = parseQueryNo(c.queryNo); if (n !== null && n > max) max = n; }
  return max + 1;
}

// Gives every case a query number. Cases keep the number they have; a number that
// two different cases ended up with (two people saving at the same moment) stays with
// the earlier case and the other one gets a new number; cases without one are
// numbered in the order they were entered — oldest case date first, then the order
// in the list. Returns the SAME array when nothing needed changing.
export function assignQueryNos<T extends Case>(cases: T[], stampAt?: number, firm?: (c: T) => boolean): T[] {
  const order = cases.map((c, i) => ({ c, i }));
  // who keeps a number that is held twice: a case whose number is already saved (`firm`),
  // then the earlier case date, then the earlier in the list
  const rank = (c: T) => (firm && firm(c) ? 0 : 1);
  const keep = [...order].sort((a, b) => rank(a.c) - rank(b.c) || (a.c.createdAt || '').localeCompare(b.c.createdAt || '') || a.i - b.i);
  const used = new Set<number>();
  const clear = new Set<string>();
  for (const { c } of keep) {
    const n = parseQueryNo(c.queryNo);
    if (n === null) continue;
    if (used.has(n)) clear.add(c.id); else used.add(n);
  }
  const needs = keep.filter(x => parseQueryNo(x.c.queryNo) === null || clear.has(x.c.id));
  if (!needs.length) return cases;
  let next = used.size ? Math.max(...used) + 1 : 1;
  const given = new Map<string, string>();
  for (const { c } of needs) given.set(c.id, formatQueryNo(next++));
  return cases.map(c => {
    const q = given.get(c.id);
    if (!q) return c;
    return { ...c, queryNo: q, ...(stampAt ? { _u: stampAt } : {}) } as T;
  });
}

// The label shown for a case: "GG07", or the old reference code for a case that has no number yet.
export const queryLabel = (c: Pick<Case, 'queryNo' | 'referenceCode'>) => c.queryNo || '—';

// A person recommended by an existing client: "GG07 — Ali Khan".
export function referrerOptions(cases: Case[], excludeId?: string) {
  return cases
    .filter(c => c.queryNo && c.id !== excludeId)
    .slice()
    .sort((a, b) => (parseQueryNo(b.queryNo) || 0) - (parseQueryNo(a.queryNo) || 0))
    .map(c => ({ value: c.queryNo as string, label: `${c.queryNo} — ${c.name}`, caseId: c.id }));
}
export function referrerOf(c: Pick<Case, 'referredByQueryNo'>, cases: Case[]): Case | undefined {
  return c.referredByQueryNo ? cases.find(x => x.queryNo === c.referredByQueryNo) : undefined;
}

// ---------- the month-wise list: latest first ----------
export const monthOf = (c: Case): string => (closedOn(c) || '').slice(0, 7);
// Newest case date first; on the same day the later query number first.
export function compareLatest(a: { c: Case; i: number }, b: { c: Case; i: number }): number {
  const da = closedOn(a.c) || '', db = closedOn(b.c) || '';
  if (da !== db) return da < db ? 1 : -1;
  const na = parseQueryNo(a.c.queryNo), nb = parseQueryNo(b.c.queryNo);
  if (na !== null && nb !== null && na !== nb) return nb - na;
  const ca = a.c.createdAt || '', cb = b.c.createdAt || '';
  if (ca !== cb) return ca < cb ? 1 : -1;
  return b.i - a.i;
}
export function sortLatest(cases: Case[]): Case[] {
  return cases.map((c, i) => ({ c, i })).sort(compareLatest).map(x => x.c);
}

export interface MonthFolder { month: string; label: string; count: number; billed: number; paid: number; pending: number }
export function monthFolders(cases: Case[]): MonthFolder[] {
  const by = new Map<string, MonthFolder>();
  for (const c of cases) {
    const m = monthOf(c) || 'unknown';
    const f = by.get(m) || { month: m, label: m === 'unknown' ? 'No date' : monthLabel(m), count: 0, billed: 0, paid: 0, pending: 0 };
    f.count++; f.billed += caseCharge(c); f.paid += casePaid(c); f.pending += Math.max(0, caseCharge(c) - casePaid(c));
    by.set(m, f);
  }
  return [...by.values()].sort((a, b) => b.month.localeCompare(a.month));
}

// ---------- payouts for a client's file ----------
export const OUTLAY_CATEGORY = 'Embassy fees';
export const outlayTxId = (o: Pick<CaseOutlay, 'id'>) => `tx_${o.id}`;
export const outlayTotal = (c: Pick<Case, 'outlays'>) => (c.outlays || []).reduce((s, o) => s + (Number(o.amount) || 0), 0);
export const outlayPosted = (c: Pick<Case, 'outlays'>) => (c.outlays || []).filter(o => o.posted).reduce((s, o) => s + (Number(o.amount) || 0), 0);
// What the file costs us to carry out: the figure typed in the case file, or the payouts listed, whichever is more.
export const caseCost = (c: Pick<Case, 'costToExecute' | 'outlays'>) => Math.max(c.costToExecute || 0, outlayTotal(c));

// PKR for a payment made in another currency: amount × rate.
export const toPkr = (foreign: number, rate: number) => Math.round((Number(foreign) || 0) * (Number(rate) || 0));

// Adds to Expenses every payout whose date has come and that is not in the books yet.
// Safe to run again and again (and from two places): each payout always gets the same
// expense id, so it can only ever be added once.
export function postDueOutlays(cases: Case[], transactions: Transaction[], todayStr: string, stampAt: number): { cases: Case[]; transactions: Transaction[]; posted: number } {
  const have = new Set(transactions.map(t => t.id));
  const newTx: Transaction[] = [];
  let posted = 0;
  const nextCases = cases.map(c => {
    const outlays = c.outlays;
    if (!outlays || !outlays.length) return c;
    let changed = false;
    const list = outlays.map(o => {
      if (o.posted || !o.date || o.date > todayStr || !(Number(o.amount) > 0)) return o;
      const id = outlayTxId(o);
      if (!have.has(id)) {
        have.add(id);
        newTx.push({
          id, date: o.date, type: 'Expense', category: o.category || OUTLAY_CATEGORY, party: c.name, amount: Math.round(Number(o.amount)),
          note: `${o.label}${o.currency && o.foreignAmount ? ` (${o.currency} ${o.foreignAmount} @ ${o.rate})` : ''} — ${c.queryNo || c.referenceCode}`, caseId: c.id,
        });
        posted++;
      }
      changed = true;
      return { ...o, posted: true, txId: id };
    });
    return changed ? ({ ...c, outlays: list, _u: stampAt } as Case) : c;
  });
  if (!posted && nextCases.every((c, i) => c === cases[i])) return { cases, transactions, posted: 0 };
  return { cases: nextCases, transactions: newTx.length ? [...transactions, ...newTx] : transactions, posted };
}

// ---------- the month's finance details ----------
export interface AgentRow {
  staffId: string; name: string; cases: number; applicants: number;
  billed: number; ourBusiness: number; paid: number; pending: number; closed: number;
}
export interface MonthBook {
  month: string; label: string;
  cases: number; applicants: number; families: number;
  inProgress: number; approved: number; refused: number; closed: number; finished: number;
  billed: number;            // what clients were charged on these files (after discounts)
  apptCharges: number;       // …of which appointment / embassy fees passed on
  ourBusiness: number;       // billed − appointment fees = what is really ours
  discounts: number;
  paid: number; pending: number;                 // on these files, up to today
  collectedInMonth: number;                      // all client money received in the month
  collectedFromThese: number; collectedFromEarlier: number;
  pendingAtMonthEnd: number;                     // still owed by every client on the last day, carried forward
  outlaysPlanned: number; outlaysPosted: number; // payouts for these files
  agents: AgentRow[];
}

// One row per agent (the person who closed the file): cases, business, paid, pending.
export function agentRows(mine: Case[], team: Pick<TeamMember, 'id' | 'name'>[]): AgentRow[] {
  const byAgent = new Map<string, AgentRow>();
  for (const c of mine) {
    const id = closerOf(c) || '';
    const row = byAgent.get(id) || { staffId: id, name: id ? (team.find(t => t.id === id)?.name || 'Former staff') : 'Not closed yet', cases: 0, applicants: 0, billed: 0, ourBusiness: 0, paid: 0, pending: 0, closed: 0 };
    const ch = caseCharge(c);
    row.cases++; row.applicants += applicantsOf(c); row.billed += ch;
    row.ourBusiness += Math.max(0, ch - Math.max(0, c.apptFee || 0));
    row.paid += casePaid(c); row.pending += Math.max(0, ch - casePaid(c));
    if (c.status !== 'Active') row.closed++;
    byAgent.set(id, row);
  }
  return [...byAgent.values()].sort((a, b) => b.billed - a.billed);
}

export function monthBook(month: string, cases: Case[], transactions: Transaction[], team: Pick<TeamMember, 'id' | 'name'>[], todayStr: string): MonthBook {
  const mine = cases.filter(c => monthOf(c) === month);
  const f = computeMonth(month, transactions, cases, [], todayStr);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const billed = sum(mine.map(caseCharge));
  const apptCharges = sum(mine.map(c => Math.min(caseCharge(c), Math.max(0, c.apptFee || 0))));
  const agents = agentRows(mine, team);
  return {
    month, label: monthLabel(month),
    cases: mine.length, applicants: sum(mine.map(applicantsOf)), families: mine.filter(isFamilyCase).length,
    inProgress: mine.filter(c => c.status === 'Active').length,
    approved: mine.filter(c => c.status === 'Approved').length,
    refused: mine.filter(c => c.status === 'Refused').length,
    closed: mine.filter(c => c.status === 'Closed').length,
    finished: mine.filter(c => c.status !== 'Active').length,
    billed, apptCharges, ourBusiness: Math.max(0, billed - apptCharges), discounts: sum(mine.map(c => c.discount || 0)),
    paid: sum(mine.map(casePaid)), pending: sum(mine.map(c => Math.max(0, caseCharge(c) - casePaid(c)))),
    collectedInMonth: f.collections, collectedFromThese: f.fromNew, collectedFromEarlier: f.fromEarlier,
    pendingAtMonthEnd: f.pendingTotal,
    outlaysPlanned: sum(mine.map(outlayTotal)), outlaysPosted: sum(mine.map(outlayPosted)),
    agents,
  };
}

// ---------- one day's figures ----------
export interface DayBook {
  date: string;
  cases: number; applicants: number;
  billed: number; apptCharges: number; ourBusiness: number;     // files closed on this day
  paid: number; pending: number;                                // on those files, up to today
  collected: number; fromToday: number; fromEarlier: number; unlinked: number;   // client money received on this day
  owedAtEnd: number;                                            // still owed by every client at the end of the day
  payouts: number;                                              // embassy / appointment fees that left the account this day
  agents: AgentRow[];
}
export function dayBook(date: string, cases: Case[], transactions: Transaction[], team: Pick<TeamMember, 'id' | 'name'>[]): DayBook {
  const mine = cases.filter(c => closedOn(c) === date);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const billed = sum(mine.map(caseCharge));
  const apptCharges = sum(mine.map(c => Math.min(caseCharge(c), Math.max(0, c.apptFee || 0))));
  const clientPay = transactions.filter(t => t.type === 'Income' && CLIENT_PAYMENT_CATEGORIES.includes(t.category));
  const today = clientPay.filter(t => t.date === date);
  let fromToday = 0, fromEarlier = 0, unlinked = 0;
  for (const t of today) {
    const c = caseForTx(t, cases);
    if (!c) unlinked += t.amount; else if (closedOn(c) === date) fromToday += t.amount; else fromEarlier += t.amount;
  }
  // owed at the end of the day: what each file was charged, less what had arrived by then
  const after = new Map<string, number>();
  for (const t of clientPay) {
    if (t.date <= date) continue;
    const c = caseForTx(t, cases); if (!c) continue;
    after.set(c.id, (after.get(c.id) || 0) + t.amount);
  }
  const owedAtEnd = sum(cases.filter(c => closedOn(c) <= date).map(c => Math.max(0, caseCharge(c) - Math.max(0, casePaid(c) - (after.get(c.id) || 0)))));
  return {
    date, cases: mine.length, applicants: sum(mine.map(applicantsOf)),
    billed, apptCharges, ourBusiness: Math.max(0, billed - apptCharges),
    paid: sum(mine.map(casePaid)), pending: sum(mine.map(c => Math.max(0, caseCharge(c) - casePaid(c)))),
    collected: fromToday + fromEarlier + unlinked, fromToday, fromEarlier, unlinked, owedAtEnd,
    payouts: sum(transactions.filter(t => t.type === 'Expense' && t.date === date && t.category === OUTLAY_CATEGORY).map(t => t.amount)),
    agents: agentRows(mine, team),
  };
}
