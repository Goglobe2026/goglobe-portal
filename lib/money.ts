import type { TeamMember, BankAccount, MonthlyClosing } from './types';
import { computeMonth, monthLabel, shiftMonth, monthEnd, daysBetween, closingDueDate } from './finance';
import { statementFor, keptApart, trend, compare, type ProfitInput, type TrendPoint } from './profit';
import { upcomingPayouts, expectedCollections } from './payouts';

// ---------------------------------------------------------------------------
// The "Finance overview" in plain words.
//
// Four numbers answer four questions. Everything is worked out from the same
// cash records the other finance screens use, so nothing here can disagree with
// them:
//
//   RECEIVED      the cash that actually arrived in the month
//   SPENT         the cash that actually left in the month
//   WHAT WE KEPT  received minus spent
//   STILL OWED    what clients have not paid yet, on the last day of the month
//
// Nothing is saved — it is worked out every time it is shown.
// ---------------------------------------------------------------------------

export interface MoneyInput extends ProfitInput {
  team: TeamMember[]; bankAccounts: BankAccount[]; monthlyClosings: MonthlyClosing[];
}

export interface SpendGroup { id: 'staff' | 'passThrough' | 'advertising' | 'referral' | 'office'; label: string; note: string; amount: number }
export interface OwingRow { caseId: string; name: string; destination: string; amount: number; days: number }
export interface AttentionItem { tone: 'bad' | 'warn' | 'info' | 'good'; text: string; go: string; goLabel: string }
export interface SoonItem { kind: 'in' | 'out'; date: string; who: string; what: string; amount: number }

export interface MoneyHome {
  month: string; label: string; running: boolean;
  sold: number; soldFiles: number;
  received: number; receivedClients: number; receivedOther: number;
  spent: number; spendGroups: SpendGroup[];
  kept: number; keptShare: number | null;
  stillOwed: number; owedFiles: number; owingTop: OwingRow[];
  lateNow: number | null; lateFiles: number;
  bank: number;
  prev: { label: string; received: number; spent: number; kept: number } | null;
  trend: TrendPoint[];
  soon: SoonItem[]; soonIn: number; soonOut: number;
  payoutsOverdue: number; payoutsThisMonth: number; payoutsTotal: number;
  unpaidPayroll: number;
  closed: boolean;
  attention: AttentionItem[];
  story: string[];
}

const fmt = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-US');
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function moneyHome(month: string, d: MoneyInput, todayIso: string): MoneyHome {
  const currentMonth = todayIso.slice(0, 7);
  const running = month >= currentMonth;
  const f = computeMonth(month, d.transactions, d.cases, d.payRuns, todayIso);
  const st = statementFor(month, d, todayIso);
  const ka = keptApart(month, d, todayIso);
  const cmp = compare(month, d, todayIso);

  const spendGroups: SpendGroup[] = ([
    { id: 'staff', label: 'Staff pay', note: 'salaries, commissions, bonuses and advances', amount: st.staffTotal },
    { id: 'passThrough', label: 'Embassy & appointment fees', note: 'paid to the embassy on the client’s behalf', amount: st.passThrough },
    { id: 'advertising', label: 'Advertising', note: 'Meta and other ads', amount: st.advertising },
    { id: 'referral', label: 'Partner commissions', note: 'paid to referral agents', amount: st.referral },
    { id: 'office', label: 'Office & everything else', note: st.officeRows.slice(0, 3).map(r => r.category).join(', ') || 'rent, bills, other', amount: st.office },
  ] as SpendGroup[]).filter(g => g.amount > 0).sort((a, b) => b.amount - a.amount);

  const owingTop: OwingRow[] = f.pendingRows.slice(0, 5).map(r => ({
    caseId: r.caseRec.id, name: r.caseRec.name, destination: r.caseRec.destination, amount: r.outstanding, days: r.ageDays,
  }));

  // What is late and what is due soon only makes sense from today's point of view.
  const inn = expectedCollections(d.cases, d.appointments, todayIso, 2);
  const out = upcomingPayouts({ cases: d.cases, team: d.team, payRuns: d.payRuns }, todayIso, 2);
  const week = shiftDay(todayIso, 7);

  const soon: SoonItem[] = [];
  [...inn.overdue.chunks, ...inn.months.flatMap(m => m.chunks)].forEach(ch => {
    if (ch.status === 'Overdue' || (ch.due && ch.due <= week)) soon.push({ kind: 'in', date: ch.due, who: ch.name, what: ch.label, amount: ch.remaining });
  });
  [...out.overdue.items, ...out.months.flatMap(m => m.items)].forEach(it => {
    if (it.date && it.date <= week) soon.push({ kind: 'out', date: it.date, who: it.who, what: `${it.kind}${it.sure ? '' : ' (estimate)'}`, amount: it.amount });
  });
  soon.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || b.amount - a.amount);

  const lateNow = running ? inn.overdue.amount : null;
  const lateFiles = running ? inn.overdue.files : 0;
  const lastMonth = shiftMonth(currentMonth, -1);
  const closed = d.monthlyClosings.some(c => c.month === month);
  const lastHadActivity = d.transactions.some(t => t.date.slice(0, 7) === lastMonth);
  const lastClosed = d.monthlyClosings.some(c => c.month === lastMonth);

  const attention: AttentionItem[] = [];
  if (lateNow && lateNow > 0) attention.push({ tone: 'bad', text: `${fmt(lateNow)} is late — ${lateFiles} client${lateFiles === 1 ? '' : 's'} passed the date they promised to pay.`, go: 'billing', goLabel: 'Send reminders' });
  if (out.overdue.total > 0) attention.push({ tone: 'bad', text: `${fmt(out.overdue.total)} should already have been paid out (date passed).`, go: 'payouts', goLabel: 'See what to pay' });
  if (ka.unpaidPayroll > 0) attention.push({ tone: 'warn', text: `Payroll of ${fmt(ka.unpaidPayroll)} is approved but not paid to ${ka.unpaidPayrollStaff} staff yet.`, go: 'payroll', goLabel: 'Open payroll' });
  if (lastHadActivity && !lastClosed) {
    const due = closingDueDate(lastMonth);
    const dueText = new Date(due + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    attention.push({ tone: due < todayIso ? 'bad' : 'warn', text: `${monthLabel(lastMonth)} has not been closed yet (${due < todayIso ? 'it was due on' : 'due by'} ${dueText}).`, go: 'closing', goLabel: 'Close the month' });
  }
  if (st.netProfit < 0 && (st.totalIn > 0 || st.totalOut > 0)) attention.push({ tone: 'bad', text: `We spent ${fmt(st.totalOut)} but only received ${fmt(st.totalIn)} — a gap of ${fmt(-st.netProfit)}.`, go: 'profit', goLabel: 'See why' });
  const noDate = inn.undated.amount;
  if (running && noDate > 0) attention.push({ tone: 'info', text: `${fmt(noDate)} is owed by ${inn.undated.files} client${inn.undated.files === 1 ? '' : 's'} who have not given a payment date.`, go: 'billing', goLabel: 'Ask for a date' });
  if (!attention.length) attention.push({ tone: 'good', text: 'Nothing is late and nothing is waiting on you. Good position.', go: 'billing', goLabel: 'See who owes us' });

  const label = monthLabel(month);
  const story: string[] = [];
  if (f.newCaseCount > 0) story.push(`In ${label} you opened ${f.newCaseCount} file${f.newCaseCount === 1 ? '' : 's'} worth ${fmt(f.bookedValue)}.`);
  else story.push(`No new files were opened in ${label}.`);
  story.push(`Clients paid ${fmt(st.clientMoney)}${st.otherIncome > 0 ? ` and ${fmt(st.otherIncome)} came in from other sources` : ''}, so ${fmt(st.totalIn)} reached the account.`);
  story.push(`You spent ${fmt(st.totalOut)}${st.passThrough > 0 ? ` — ${fmt(st.passThrough)} of that went straight to embassies for clients` : ''}.`);
  story.push(st.netProfit >= 0 ? `That leaves ${fmt(st.netProfit)} that the business kept.` : `That is ${fmt(-st.netProfit)} more going out than coming in.`);
  story.push(f.pendingTotal > 0 ? `Clients still owe ${fmt(f.pendingTotal)} on ${f.pendingRows.length} file${f.pendingRows.length === 1 ? '' : 's'} — that money is not counted above until they pay.` : 'No client owes anything.');

  return {
    month, label, running,
    sold: f.bookedValue, soldFiles: f.newCaseCount,
    received: st.totalIn, receivedClients: st.clientMoney, receivedOther: st.otherIncome,
    spent: st.totalOut, spendGroups,
    kept: st.netProfit, keptShare: st.margin,
    stillOwed: f.pendingTotal, owedFiles: f.pendingRows.length, owingTop,
    lateNow, lateFiles,
    bank: sum(d.bankAccounts.map(b => b.balance)),
    prev: cmp.prev ? { label: monthLabel(shiftMonth(month, -1)), received: cmp.prev.moneyIn, spent: cmp.prev.moneyOut, kept: cmp.prev.netProfit } : null,
    trend: trend(month, d, todayIso, 6),
    soon: soon.slice(0, 10), soonIn: sum(soon.filter(x => x.kind === 'in').map(x => x.amount)), soonOut: sum(soon.filter(x => x.kind === 'out').map(x => x.amount)),
    payoutsOverdue: out.overdue.total, payoutsThisMonth: out.months[0]?.total || 0, payoutsTotal: out.total,
    unpaidPayroll: ka.unpaidPayroll,
    closed, attention, story,
  };
}

function shiftDay(iso: string, days: number) {
  const dt = new Date(iso + 'T00:00:00'); dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
export const daysFrom = daysBetween;
export const lastDayOf = monthEnd;

// The four headline numbers, for the group page and the home screen.
export function moneyHeadline(d: MoneyInput, todayIso: string) {
  const m = moneyHome(todayIso.slice(0, 7), d, todayIso);
  return { received: m.received, spent: m.spent, kept: m.kept, stillOwed: m.stillOwed, bank: m.bank, label: m.label };
}
