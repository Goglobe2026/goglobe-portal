import type { Case, TeamMember, PayRun, Appointment } from './types';
import { caseCharge, casePaid, closedOn, payrollDueDate, shiftMonth, monthLabel } from './finance';
import { forecast, type Forecast } from './paymentPlan';
import { caseCost } from './caseBook';

// ---------------------------------------------------------------------------
// Upcoming payouts: the money that is going to leave the account, and when, next to
// the money that is expected to come in. Nothing here is saved — it is worked out
// from the cases, payroll and team every time it is shown.
// ---------------------------------------------------------------------------

export type PayoutKind = 'Embassy / appointment fee' | 'Salary' | 'Case bonus' | 'Referral commission';
export interface PayoutItem {
  kind: PayoutKind;
  who: string;          // client or employee or agent
  detail: string;
  amount: number;
  date: string;         // '' = no date yet
  sure: boolean;        // false = an estimate (payroll not created yet)
  caseId?: string;
}
export interface PayoutMonth { key: string; label: string; total: number; items: PayoutItem[] }
export interface Payouts {
  overdue: PayoutMonth;       // dated before today and not paid yet
  months: PayoutMonth[];      // this month and the next ones
  later: PayoutMonth;
  undated: PayoutMonth;
  total: number;
  estimated: number;          // how much of the total is an estimate
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const lineNet = (l: PayRun['lines'][number]) => l.items.reduce((s, i) => s + (i.kind === 'Earning' ? i.amount : -i.amount), 0);

export function upcomingPayouts(
  d: { cases: Case[]; team: TeamMember[]; payRuns: PayRun[] }, todayStr: string, monthsAhead = 3,
): Payouts {
  const items: PayoutItem[] = [];

  // 1. Payouts listed on client files that are not in the books yet.
  for (const c of d.cases) {
    for (const o of c.outlays || []) {
      if (o.posted || !(Number(o.amount) > 0)) continue;
      items.push({ kind: 'Embassy / appointment fee', who: c.name, detail: `${o.label} — ${c.queryNo || c.referenceCode}`, amount: Math.round(o.amount), date: o.date || '', sure: true, caseId: c.id });
    }
  }

  // 2. Salaries: payroll that is approved and not yet paid, otherwise an estimate of the next run.
  const thisMonth = todayStr.slice(0, 7);
  const covered = new Set<string>();
  for (const r of d.payRuns) {
    if (r.status === 'Draft') continue;
    covered.add(r.month);
    for (const l of r.lines) {
      if (l.paid) continue;
      items.push({ kind: 'Salary', who: l.staffName, detail: `${monthLabel(r.month)} payroll (approved, not paid yet)`, amount: Math.round(lineNet(l)), date: r.dueDate || payrollDueDate(r.month), sure: true });
    }
  }
  const active = d.team.filter(t => (!t.employmentStatus || t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave'));
  // the payroll month that is paid next: last month's if its pay day (the 5th) has not passed, else this month's
  const lastMonth = shiftMonth(thisMonth, -1);
  const next = todayStr <= payrollDueDate(lastMonth) ? lastMonth : thisMonth;
  for (const m of [next, shiftMonth(next, 1)]) {
    if (covered.has(m)) continue;
    const date = payrollDueDate(m);
    for (const t of active) {
      const pay = (t.salary || 0) + (t.monthlyAllowance || 0);
      if (pay > 0) items.push({ kind: 'Salary', who: t.name, detail: `${monthLabel(m)} salary (estimate until payroll is created)`, amount: Math.round(pay), date, sure: false });
    }
  }

  // 3. Case bonuses promised and not paid yet — paid with the payroll of their month.
  for (const c of d.cases) {
    for (const b of c.caseBonuses || []) {
      if (b.paid || !(b.amount > 0)) continue;
      const who = d.team.find(t => t.id === b.staffId)?.name || 'Employee';
      items.push({ kind: 'Case bonus', who, detail: `Bonus on ${c.name} (${c.queryNo || c.referenceCode})`, amount: Math.round(b.amount), date: payrollDueDate(b.month || thisMonth), sure: true, caseId: c.id });
    }
  }

  // 4. Referral commission earned and not paid yet.
  for (const c of d.cases) {
    if (!c.referralAgentId || !(c.referralCommissionPercent > 0) || c.status === 'Refused') continue;
    const earned = Math.round(Math.max(0, caseCharge(c) - caseCost(c)) * (c.referralCommissionPercent / 100));
    const due = Math.max(0, earned - (c.referralCommissionPaid || 0));
    if (due > 0) items.push({ kind: 'Referral commission', who: c.name, detail: `Commission on ${c.queryNo || c.referenceCode}`, amount: due, date: '', sure: true, caseId: c.id });
  }

  // Sort into the buckets.
  const mk = (key: string, label: string): PayoutMonth => ({ key, label, total: 0, items: [] });
  const overdue = mk('overdue', 'Overdue — date passed, not paid'), later = mk('later', 'Later'), undated = mk('undated', 'No date set');
  const months = Array.from({ length: monthsAhead }, (_, i) => { const m = shiftMonth(thisMonth, i); return mk(m, monthLabel(m)); });
  let estimated = 0;
  for (const it of items) {
    if (!it.sure) estimated += it.amount;
    const put = (b: PayoutMonth) => { b.items.push(it); b.total += it.amount; };
    if (!it.date) { put(undated); continue; }
    if (it.date < todayStr) { put(overdue); continue; }
    const b = months.find(m => m.key === it.date.slice(0, 7));
    put(b || later);
  }
  for (const b of [overdue, later, undated, ...months]) b.items.sort((a, c) => (a.date || '9999').localeCompare(c.date || '9999') || c.amount - a.amount);
  return { overdue, months, later, undated, total: sum(items.map(i => i.amount)), estimated };
}

// Money still to be collected from clients, by when it is expected (same buckets as the payouts).
export function expectedCollections(cases: Case[], appts: Appointment[], todayStr: string, monthsAhead = 3): Forecast {
  const open = cases.filter(c => c.status !== 'Refused' && closedOn(c) <= todayStr && caseCharge(c) - casePaid(c) > 0);
  return forecast(open.map(c => ({ c })), appts, todayStr, { monthsAhead });
}
