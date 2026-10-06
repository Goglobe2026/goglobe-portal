import type { Case, Transaction, PayRun } from './types';

// Money received from clients on a case. Everything else coming in is
// "other income" and everything going out is an expense.
export const CLIENT_PAYMENT_CATEGORIES = ['Case payment', 'Appointment fee', 'Consultation fee'];
const COMMISSION_BONUS_CATEGORIES = ['Commission', 'Bonus', 'Appreciation'];

export const caseCharge = (c: Case) => Math.max(0, c.fee + c.apptFee + c.consultFee - c.discount);
export const casePaid = (c: Case) => c.paid + c.apptPaid + c.consultPaid;

export function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
export function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function monthEnd(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Month-end closing is due on the 5th of the following month.
export function closingDueDate(m: string) { return `${shiftMonth(m, 1)}-05`; }
export function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(fromIso + 'T00:00:00').getTime();
  const b = new Date(toIso + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function caseForTx(tx: Transaction, cases: Case[]): Case | undefined {
  if (tx.caseId) return cases.find(c => c.id === tx.caseId);
  if (!CLIENT_PAYMENT_CATEGORIES.includes(tx.category)) return undefined;
  return cases.find(c => c.name === tx.party);
}

export type CollectionRow = {
  tx: Transaction; caseRec?: Case; label: string; receivedToDate: number; caseTotal: number; balanceAfter: number;
};
export type PendingRow = {
  caseRec: Case; total: number; received: number; outstanding: number; lastPayment: string; ageDays: number;
};
export type MonthFigures = ReturnType<typeof computeMonth>;

export function computeMonth(month: string, transactions: Transaction[], cases: Case[], runs: PayRun[], todayIso: string) {
  const end = monthEnd(month);
  const inMonth = transactions.filter(t => t.date.slice(0, 7) === month);
  const incomes = inMonth.filter(t => t.type === 'Income');
  const expenses = inMonth.filter(t => t.type === 'Expense');
  const isClientPay = (t: Transaction) => CLIENT_PAYMENT_CATEGORIES.includes(t.category);

  // Every client payment, in date order, per case — lets us call a payment an
  // advance, an instalment or the final balance.
  const allClientPay = transactions.filter(t => t.type === 'Income' && isClientPay(t)).slice().sort((a, b) => a.date.localeCompare(b.date));
  const perCase = new Map<string, Transaction[]>();
  allClientPay.forEach(t => {
    const c = caseForTx(t, cases);
    if (!c) return;
    perCase.set(c.id, [...(perCase.get(c.id) || []), t]);
  });

  const collectionTx = incomes.filter(isClientPay);
  const collectionRows: CollectionRow[] = collectionTx
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map(tx => {
      const caseRec = caseForTx(tx, cases);
      let label = 'Payment'; let receivedToDate = tx.amount; let caseTotal = 0; let balanceAfter = 0;
      if (caseRec) {
        const list = perCase.get(caseRec.id) || [];
        const k = list.findIndex(x => x.id === tx.id);
        const cum = list.slice(0, k + 1).reduce((s, x) => s + x.amount, 0);
        caseTotal = caseCharge(caseRec); receivedToDate = cum; balanceAfter = Math.max(0, caseTotal - cum);
        if (k === 0 && cum >= caseTotal) label = 'Full payment';
        else if (cum >= caseTotal) label = 'Final balance';
        else if (k === 0) label = 'Advance';
        else label = 'Instalment';
      }
      return { tx, caseRec, label, receivedToDate, caseTotal, balanceAfter };
    });

  const collections = collectionTx.reduce((s, t) => s + t.amount, 0);
  const otherIncomeTx = incomes.filter(t => !isClientPay(t));
  const otherIncome = otherIncomeTx.reduce((s, t) => s + t.amount, 0);

  const sum = (arr: Transaction[]) => arr.reduce((s, t) => s + t.amount, 0);
  const salaries = sum(expenses.filter(t => t.category === 'Salary'));
  const commissionsBonuses = sum(expenses.filter(t => COMMISSION_BONUS_CATEGORIES.includes(t.category)));
  const otherExpenseTx = expenses.filter(t => t.category !== 'Salary' && !COMMISSION_BONUS_CATEGORIES.includes(t.category));
  const otherExpenses = sum(otherExpenseTx);

  const byCategory = new Map<string, number>();
  expenses.forEach(t => byCategory.set(t.category, (byCategory.get(t.category) || 0) + t.amount));
  const expenseRows = Array.from(byCategory.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

  const staffPayments = expenses
    .filter(t => t.category === 'Salary' || COMMISSION_BONUS_CATEGORIES.includes(t.category))
    .slice().sort((a, b) => a.date.localeCompare(b.date));

  // Business booked this month versus cash collected: the heart of the
  // "we closed 100,000 but only received 40,000" question.
  const newCases = cases.filter(c => c.createdAt.slice(0, 7) === month);
  const bookedValue = newCases.reduce((s, c) => s + caseCharge(c), 0);
  const fromNew = collectionRows.filter(r => r.caseRec && r.caseRec.createdAt.slice(0, 7) === month).reduce((s, r) => s + r.tx.amount, 0);
  const fromEarlier = collectionRows.filter(r => r.caseRec && r.caseRec.createdAt.slice(0, 7) !== month).reduce((s, r) => s + r.tx.amount, 0);
  const unlinked = collectionRows.filter(r => !r.caseRec).reduce((s, r) => s + r.tx.amount, 0);

  // What was still owed on the last day of the month, case by case.
  const pendingRows: PendingRow[] = cases
    .filter(c => c.createdAt <= end)
    .map(c => {
      const after = (perCase.get(c.id) || []).filter(t => t.date > end).reduce((s, t) => s + t.amount, 0);
      const received = Math.max(0, casePaid(c) - after);
      const total = caseCharge(c);
      const last = (perCase.get(c.id) || []).filter(t => t.date <= end).map(t => t.date).sort().pop() || '';
      return { caseRec: c, total, received, outstanding: total - received, lastPayment: last, ageDays: Math.max(0, daysBetween(c.createdAt, end)) };
    })
    .filter(r => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
  const pendingTotal = pendingRows.reduce((s, r) => s + r.outstanding, 0);

  // Payroll that is approved but not yet paid out — owed to staff, not yet cash.
  const unpaidPayroll = runs.filter(r => r.status === 'Approved').flatMap(r =>
    r.lines.filter(l => !l.paid).map(l => ({ staffName: l.staffName, month: r.month,
      net: l.items.reduce((s, i) => s + (i.kind === 'Earning' ? i.amount : -i.amount), 0) })));
  const unpaidPayrollTotal = unpaidPayroll.reduce((s, x) => s + x.net, 0);

  const totalIn = collections + otherIncome;
  const totalOut = salaries + commissionsBonuses + otherExpenses;

  return {
    month, end, collections, otherIncome, otherIncomeTx, salaries, commissionsBonuses, otherExpenses,
    totalIn, totalOut, net: totalIn - totalOut,
    collectionRows, expenseRows, staffPayments,
    newCaseCount: newCases.length, bookedValue, fromNew, fromEarlier, unlinked,
    pendingRows, pendingTotal, unpaidPayroll, unpaidPayrollTotal,
  };
}
