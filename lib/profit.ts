import type { Case, Transaction, Lead, PayRun, Loan, PersonalExpense, Appointment } from './types';
import { computeMonth, caseCharge, closedOn, shiftMonth, monthEnd } from './finance';
import { forecast, type Forecast } from './paymentPlan';

// ---------------------------------------------------------------------------
// Profit & Growth.
//
// Net profit here is the same cash-basis picture the Monthly Closing uses:
// what was actually received in the month minus what was actually paid out in
// the month. A payment is counted in the month it arrives, never when a file is
// booked. Everything that looks like money but is not profit (what clients
// still owe, salaries approved but unpaid, loans, the owner's personal spending)
// is shown on its own, "kept apart", so it can never inflate or hide the profit.
// ---------------------------------------------------------------------------

export const PASS_THROUGH_CATEGORIES = ['Embassy fees'];                       // paid to the embassy on the client's behalf
export const STAFF_CATEGORIES = ['Salary', 'Commission', 'Bonus', 'Appreciation', 'Staff advance'];
export const REFERRAL_CATEGORIES = ['Referral commission'];
export const ADVERTISING_CATEGORIES = ['Marketing'];

export type ExpenseGroup = 'passThrough' | 'staff' | 'referral' | 'advertising' | 'office';
export function groupOfExpense(category: string): ExpenseGroup {
  const c = (category || '').trim().toLowerCase();
  if (PASS_THROUGH_CATEGORIES.some(x => x.toLowerCase() === c)) return 'passThrough';
  if (STAFF_CATEGORIES.some(x => x.toLowerCase() === c)) return 'staff';
  if (REFERRAL_CATEGORIES.some(x => x.toLowerCase() === c)) return 'referral';
  if (ADVERTISING_CATEGORIES.some(x => x.toLowerCase() === c)) return 'advertising';
  return 'office';
}

export interface ProfitInput {
  transactions: Transaction[]; cases: Case[]; leads: Lead[]; payRuns: PayRun[];
  loans: Loan[]; personalExpenses: PersonalExpense[]; appointments: Appointment[];
}

export interface Row { category: string; total: number }
export interface Statement {
  month: string; end: string;
  clientMoney: number; otherIncome: number; totalIn: number;
  passThrough: number; serviceIncome: number;
  salaries: number; commissionsBonuses: number; advances: number; staffTotal: number;
  referral: number; advertising: number; office: number; officeRows: Row[];
  totalOut: number; netProfit: number; margin: number | null;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function statementFor(month: string, d: Pick<ProfitInput, 'transactions' | 'cases' | 'payRuns'>, todayIso: string): Statement {
  const f = computeMonth(month, d.transactions, d.cases, d.payRuns, todayIso);
  const expenses = d.transactions.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === month);
  const by = (g: ExpenseGroup) => expenses.filter(t => groupOfExpense(t.category) === g);
  const cat = (name: string) => sum(expenses.filter(t => t.category === name).map(t => t.amount));
  const passThrough = sum(by('passThrough').map(t => t.amount));
  const salaries = cat('Salary');
  const advances = cat('Staff advance');
  const staffTotal = sum(by('staff').map(t => t.amount));
  const commissionsBonuses = staffTotal - salaries - advances;
  const referral = sum(by('referral').map(t => t.amount));
  const advertising = sum(by('advertising').map(t => t.amount));
  const officeTx = by('office');
  const office = sum(officeTx.map(t => t.amount));
  const rows = new Map<string, number>();
  officeTx.forEach(t => rows.set(t.category, (rows.get(t.category) || 0) + t.amount));
  const officeRows = Array.from(rows.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  const totalIn = f.totalIn; const totalOut = f.totalOut;
  const serviceIncome = totalIn - passThrough;
  const netProfit = totalIn - totalOut;
  return {
    month, end: f.end,
    clientMoney: f.collections, otherIncome: f.otherIncome, totalIn,
    passThrough, serviceIncome,
    salaries, commissionsBonuses, advances, staffTotal, referral, advertising, office, officeRows,
    totalOut, netProfit, margin: serviceIncome > 0 ? netProfit / serviceIncome : null,
  };
}

// ---------------------------------------------------------------------------
// Money that is NOT profit: shown apart.
// ---------------------------------------------------------------------------
export interface KeptApart {
  receivable: number; receivableFiles: number; receivableForecast: Forecast;   // clients still owe at the month's last day
  unpaidPayroll: number; unpaidPayrollStaff: number;                           // approved but not yet paid out (as of today)
  loansGiven: number; loansTaken: number;                                      // outstanding (as of today)
  personal: number;                                                            // personal spending drawn in the month
  referralOwed: number; referralFiles: number;                                 // commission earned by agents, not yet paid (as of today)
}

export function keptApart(month: string, d: ProfitInput, todayIso: string): KeptApart {
  const f = computeMonth(month, d.transactions, d.cases, d.payRuns, todayIso);
  const fc = forecast(f.pendingRows.map(r => ({ c: r.caseRec, paid: r.received })), d.appointments, f.end, { monthsAhead: 3, inclusive: true });
  const loanLeft = (l: Loan) => (l.status === 'Active' ? Math.max(0, l.principal - l.amountRepaid) : 0);
  let referralOwed = 0; let referralFiles = 0;
  d.cases.forEach(c => {
    if (!c.referralAgentId || !(c.referralCommissionPercent > 0) || c.status === 'Refused') return;
    const earned = Math.round(Math.max(0, caseCharge(c) - (c.costToExecute || 0)) * (c.referralCommissionPercent / 100));
    const due = Math.max(0, earned - (c.referralCommissionPaid || 0));
    if (due > 0) { referralOwed += due; referralFiles++; }
  });
  return {
    receivable: f.pendingTotal, receivableFiles: f.pendingRows.length, receivableForecast: fc,
    unpaidPayroll: f.unpaidPayrollTotal, unpaidPayrollStaff: f.unpaidPayroll.length,
    loansGiven: sum(d.loans.filter(l => l.direction === 'Given').map(loanLeft)),
    loansTaken: sum(d.loans.filter(l => l.direction === 'Taken').map(loanLeft)),
    personal: sum(d.personalExpenses.filter(p => p.date.slice(0, 7) === month).map(p => p.amount)),
    referralOwed, referralFiles,
  };
}

// ---------------------------------------------------------------------------
// Growth figures, month by month
// ---------------------------------------------------------------------------
export interface MonthStats {
  month: string; hasData: boolean;
  leads: number; filesClosed: number; booked: number; avgFile: number; discounts: number;
  moneyIn: number; moneyOut: number; netProfit: number; collected: number;
  fromNewFiles: number;            // cash received this month on files opened this month
  adSpend: number; costPerLead: number | null; costPerFile: number | null;
  filesPer100Leads: number | null;
  receivable: number;              // owed by clients on the month's last day
}

export function statsFor(month: string, d: ProfitInput, todayIso: string): MonthStats {
  const f = computeMonth(month, d.transactions, d.cases, d.payRuns, todayIso);
  const st = statementFor(month, d, todayIso);
  const leads = d.leads.filter(l => (l.createdAt || '').slice(0, 7) === month).length;
  const closed = d.cases.filter(c => closedOn(c).slice(0, 7) === month);
  const booked = sum(closed.map(caseCharge));
  const hasData = leads > 0 || closed.length > 0 || d.transactions.some(t => t.date.slice(0, 7) === month);
  return {
    month, hasData, leads, filesClosed: closed.length, booked, avgFile: closed.length ? booked / closed.length : 0,
    discounts: sum(closed.map(c => c.discount || 0)),
    moneyIn: st.totalIn, moneyOut: st.totalOut, netProfit: st.netProfit, collected: st.clientMoney, fromNewFiles: f.fromNew,
    adSpend: st.advertising,
    costPerLead: leads > 0 && st.advertising > 0 ? st.advertising / leads : null,
    costPerFile: closed.length > 0 && st.advertising > 0 ? st.advertising / closed.length : null,
    filesPer100Leads: leads > 0 ? (closed.length / leads) * 100 : null,
    receivable: f.pendingTotal,
  };
}

// Change from `base` to `cur`, in percent. null when there is nothing to compare with.
export function changePct(cur: number | null, base: number | null): number | null {
  if (cur === null || base === null || base === 0) return null;
  return ((cur - base) / Math.abs(base)) * 100;
}

export interface Comparison { cur: MonthStats; prev: MonthStats | null; yearAgo: MonthStats | null }
export function compare(month: string, d: ProfitInput, todayIso: string): Comparison {
  const cur = statsFor(month, d, todayIso);
  const p = statsFor(shiftMonth(month, -1), d, todayIso);
  const y = statsFor(shiftMonth(month, -12), d, todayIso);
  return { cur, prev: p.hasData ? p : null, yearAgo: y.hasData ? y : null };
}

export interface TrendPoint { month: string; hasData: boolean; moneyIn: number; moneyOut: number; net: number; receivable: number }
export function trend(month: string, d: ProfitInput, todayIso: string, months = 6): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = shiftMonth(month, -i);
    const s = statsFor(m, d, todayIso);
    out.push({ month: m, hasData: s.hasData, moneyIn: s.moneyIn, moneyOut: s.moneyOut, net: s.netProfit, receivable: s.receivable });
  }
  return out;
}

// ---------------------------------------------------------------------------
// What is already promised for the coming months, against what the business
// normally spends. Judged from today.
// ---------------------------------------------------------------------------
export interface Outlook { forecast: Forecast; typicalCost: number; monthsUsed: number }
export function outlook(d: ProfitInput, todayIso: string): Outlook {
  const open = d.cases.filter(c => c.status !== 'Refused' && closedOn(c) <= todayIso && caseCharge(c) - (c.paid + c.apptPaid + c.consultPaid) > 0);
  const fc = forecast(open.map(c => ({ c })), d.appointments, todayIso, { monthsAhead: 3 });
  // Average money out over up to three finished months that have any activity.
  const thisMonth = todayIso.slice(0, 7);
  const costs: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const m = shiftMonth(thisMonth, -i);
    if (d.transactions.some(t => t.date.slice(0, 7) === m)) costs.push(statementFor(m, d, todayIso).totalOut);
  }
  return { forecast: fc, typicalCost: costs.length ? sum(costs) / costs.length : 0, monthsUsed: costs.length };
}

// ---------------------------------------------------------------------------
// Things worth a look — plain rules, nothing hidden.
// ---------------------------------------------------------------------------
export interface Note { severity: 'alert' | 'watch'; text: string }
export const PROFIT_RULES = { profitFallPct: 20, receivableRisePct: 20, costPerFileRisePct: 25, leadFallPct: 25, collectedShareMin: 40 };

const fmt = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-US');
const pctText = (n: number) => `${Math.round(Math.abs(n))}%`;

export function notesFor(month: string, d: ProfitInput, todayIso: string): Note[] {
  const { cur, prev } = compare(month, d, todayIso);
  const st = statementFor(month, d, todayIso);
  const notes: Note[] = [];
  const R = PROFIT_RULES;
  if (!cur.hasData) return notes;
  if (st.netProfit < 0) notes.push({ severity: 'alert', text: `Money paid out (${fmt(st.totalOut)}) was more than money received (${fmt(st.totalIn)}) — a loss of ${fmt(-st.netProfit)} on a cash basis.` });
  if (prev) {
    const dp = changePct(cur.netProfit, prev.netProfit);
    if (prev.netProfit > 0 && dp !== null && dp <= -R.profitFallPct && st.netProfit >= 0) notes.push({ severity: 'watch', text: `Net profit is ${pctText(dp)} lower than last month (${fmt(cur.netProfit)} against ${fmt(prev.netProfit)}).` });
    const dr = changePct(cur.receivable, prev.receivable);
    if (prev.receivable > 0 && dr !== null && dr >= R.receivableRisePct) notes.push({ severity: 'watch', text: `Unpaid client balances grew ${pctText(dr)} — from ${fmt(prev.receivable)} to ${fmt(cur.receivable)}. More is being sold than collected.` });
    const dc = changePct(cur.costPerFile, prev.costPerFile);
    if (dc !== null && dc >= R.costPerFileRisePct) notes.push({ severity: 'watch', text: `Advertising cost per closed file rose ${pctText(dc)} (${fmt(cur.costPerFile!)} against ${fmt(prev.costPerFile!)}).` });
    const dl = changePct(cur.leads, prev.leads);
    if (prev.leads >= 10 && dl !== null && dl <= -R.leadFallPct) notes.push({ severity: 'watch', text: `New leads fell ${pctText(dl)} compared with last month (${cur.leads} against ${prev.leads}).` });
  }
  if (cur.booked > 0 && (cur.fromNewFiles / cur.booked) * 100 < R.collectedShareMin && todayIso > monthEnd(month)) {
    notes.push({ severity: 'watch', text: `Only ${Math.round((cur.fromNewFiles / cur.booked) * 100)}% of the ${fmt(cur.booked)} sold this month was collected in the month — the rest is waiting to come in.` });
  }
  return notes;
}
