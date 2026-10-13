import type { Lead, Case, Transaction, Campaign, TeamMember, AttendanceRecord, Appointment, EmployeeRequest, QcCheck, PayRun, MonthlyClosing } from './types';
import { caseCharge, casePaid, closerOf, closedOn, isFamilyCase, applicantsOf, isWorkingDay, CLIENT_PAYMENT_CATEGORIES, shiftMonth, monthLabel, payrollDueDate, closingDueDate, daysBetween } from './finance';
import { spendInMonth, usdInMonth, budgetForMonth, campaignStatus } from './campaigns';
import { latestQc } from './qc';

export interface ReportData {
  leads: Lead[]; cases: Case[]; transactions: Transaction[]; campaigns: Campaign[]; team: TeamMember[];
  attendance: AttendanceRecord[]; appointments: Appointment[]; requests: EmployeeRequest[]; qcChecks: QcCheck[];
  payRuns: PayRun[]; monthlyClosings: MonthlyClosing[];
}

export interface ReportSection { key: string; icon: string; heading: string; lines: string[] }
export interface DailyReport {
  date: string;
  dateLabel: string;
  sections: ReportSection[];
  text: string;        // the full message, for WhatsApp text mode and the preview
  vars: string[];      // 7 single-line values for an approved WhatsApp template: date + one per section
  urgent: number;      // how many things need attention
}

const pkr = (n: number) => 'PKR ' + Math.round(n || 0).toLocaleString('en-US');
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const list = (names: string[], max = 4) => names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} +${names.length - max} more`;
const labelDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isClientPay = (t: Transaction) => CLIENT_PAYMENT_CATEGORIES.includes(t.category);

// Everything the Head Manager wants to know about one day, in one message.
export function buildDailyReport(date: string, d: ReportData): DailyReport {
  const month = date.slice(0, 7);
  const nameOf = (id: string) => id === 'ceo' ? 'Head Manager' : (d.team.find(t => t.id === id)?.name || '').split(' ')[0] || 'Unassigned';
  const activeStaff = d.team.filter(t => (!t.employmentStatus || t.employmentStatus === 'Active') && (!t.contractStart || t.contractStart <= date));
  const urgentNotes: string[] = [];

  // ---------------- Leads ----------------
  const newLeads = d.leads.filter(l => l.createdAt === date);
  const bySource = new Map<string, number>();
  newLeads.forEach(l => bySource.set(l.source || 'Other', (bySource.get(l.source || 'Other') || 0) + 1));
  const byCampaign = new Map<string, number>();
  newLeads.filter(l => l.campaign).forEach(l => byCampaign.set(l.campaign, (byCampaign.get(l.campaign) || 0) + 1));
  const open = d.leads.filter(l => !['Converted', 'Lost'].includes(l.stage));
  const dueToday = open.filter(l => l.nextFollowUp === date).length;
  const overdue = open.filter(l => l.nextFollowUp && l.nextFollowUp < date).length;
  const escalated = open.filter(l => l.escalated && !l.escalationResolved).length;
  const monthLeads = d.leads.filter(l => l.createdAt.slice(0, 7) === month && l.createdAt <= date).length;
  const leadLines: string[] = [];
  leadLines.push(newLeads.length
    ? `New today: ${newLeads.length} (${[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', ')})`
    : 'New today: 0');
  if (byCampaign.size) leadLines.push(`From campaigns: ${[...byCampaign.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c} ${n}`).join(', ')}`);
  leadLines.push(`Follow-ups: ${dueToday} due today, ${overdue} overdue`);
  if (escalated) leadLines.push(`Escalated and waiting: ${escalated}`);
  leadLines.push(`This month: ${monthLeads} leads`);
  if (overdue >= 5) urgentNotes.push(`${overdue} lead follow-ups are overdue`);
  if (escalated) urgentNotes.push(`${plural(escalated, 'escalated lead')} waiting for you`);

  // ---------------- Cases ----------------
  const closedToday = d.cases.filter(c => closedOn(c) === date);
  const closedMonth = d.cases.filter(c => closedOn(c).slice(0, 7) === month && closedOn(c) <= date);
  const inReview = d.cases.filter(c => c.status === 'Active' && c.caseStage === 'Manager Review');
  const qcFailed = inReview.filter(c => latestQc(d.qcChecks, c.id)?.result === 'Failed').length;
  const qcNone = inReview.filter(c => !latestQc(d.qcChecks, c.id)).length;
  const apptsToday = d.appointments.filter(a => a.date === date);
  const apptsTomorrow = d.appointments.filter(a => a.date === addDays(date, 1) && a.status !== 'Missed');
  const caseLines: string[] = [];
  caseLines.push(closedToday.length
    ? `Closed today: ${closedToday.length} — ${list(closedToday.map(c => `${c.name}${isFamilyCase(c) ? ` (family of ${applicantsOf(c)})` : ''} by ${nameOf(closerOf(c))}`), 5)}`
    : 'Closed today: 0');
  caseLines.push(`Closed this month: ${closedMonth.length}`);
  if (inReview.length) caseLines.push(`Waiting for manager review: ${inReview.length}${qcFailed || qcNone ? ` (quality check failed ${qcFailed}, not done ${qcNone})` : ''}`);
  caseLines.push(`Appointments: ${apptsToday.length} today, ${apptsTomorrow.length} tomorrow`);
  if (apptsToday.some(a => a.status === 'Missed')) urgentNotes.push(`${plural(apptsToday.filter(a => a.status === 'Missed').length, 'appointment')} missed today`);
  if (qcFailed) urgentNotes.push(`${plural(qcFailed, 'file')} failed the quality check`);

  // ---------------- Money ----------------
  const inDay = d.transactions.filter(t => t.date === date);
  const collected = inDay.filter(t => t.type === 'Income' && isClientPay(t));
  const otherIncome = inDay.filter(t => t.type === 'Income' && !isClientPay(t));
  const spent = inDay.filter(t => t.type === 'Expense');
  const sum = (a: Transaction[]) => a.reduce((s, t) => s + t.amount, 0);
  const monthTx = d.transactions.filter(t => t.date.slice(0, 7) === month && t.date <= date);
  const monthIn = sum(monthTx.filter(t => t.type === 'Income'));
  const monthOut = sum(monthTx.filter(t => t.type === 'Expense'));
  const spentByCat = new Map<string, number>();
  spent.forEach(t => spentByCat.set(t.category, (spentByCat.get(t.category) || 0) + t.amount));
  const owing = d.cases
    .filter(c => closedOn(c) <= date && c.status !== 'Refused')
    .map(c => ({ c, due: caseCharge(c) - casePaid(c) }))
    .filter(x => x.due > 0);
  const owingTotal = owing.reduce((s, x) => s + x.due, 0);
  const overdueOwing = owing.filter(x => x.c.expectedPaymentDate && x.c.expectedPaymentDate < date).sort((a, b) => b.due - a.due);
  const moneyLines: string[] = [];
  moneyLines.push(`Collected today: ${pkr(sum(collected))}${collected.length ? ` (${plural(collected.length, 'payment')})` : ''}`);
  if (otherIncome.length) moneyLines.push(`Other income today: ${pkr(sum(otherIncome))}`);
  moneyLines.push(`Spent today: ${pkr(sum(spent))}${spentByCat.size ? ` (${[...spentByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c} ${pkr(v)}`).join(', ')})` : ''}`);
  moneyLines.push(`Net today: ${pkr(sum(collected) + sum(otherIncome) - sum(spent))}`);
  moneyLines.push(`This month so far: in ${pkr(monthIn)}, out ${pkr(monthOut)}`);
  moneyLines.push(`Still to collect: ${pkr(owingTotal)} from ${plural(owing.length, 'case')}${overdueOwing.length ? ` (${overdueOwing.length} past the promised date)` : ''}`);
  if (overdueOwing.length) urgentNotes.push(`Overdue balances: ${list(overdueOwing.map(x => `${x.c.name} ${pkr(x.due)}`), 3)}`);

  // ---------------- Marketing ----------------
  const running = d.campaigns.filter(c => campaignStatus(c) === 'Running');
  const adToday = d.campaigns.reduce((s, c) => s + (c.spends || []).filter(x => x.date === date).reduce((a, x) => a + x.pkr, 0), 0);
  const usdToday = d.campaigns.reduce((s, c) => s + (c.spends || []).filter(x => x.date === date).reduce((a, x) => a + (x.usd || 0), 0), 0);
  const adMonth = d.campaigns.reduce((s, c) => s + spendInMonth(c, month), 0);
  const usdMonth = d.campaigns.reduce((s, c) => s + usdInMonth(c, month), 0);
  const budgetMonth = d.campaigns.reduce((s, c) => s + budgetForMonth(c, month), 0);
  const over = d.campaigns.filter(c => { const b = budgetForMonth(c, month); return b > 0 && spendInMonth(c, month) > b; });
  const campLeads = d.leads.filter(l => l.campaign && l.createdAt.slice(0, 7) === month && l.createdAt <= date).length;
  const mkLines: string[] = [];
  mkLines.push(`Ad spend today: ${pkr(adToday)}${usdToday ? ` ($${usdToday.toLocaleString('en-US', { maximumFractionDigits: 2 })} in dollars)` : ''}`);
  mkLines.push(`This month: ${pkr(adMonth)}${usdMonth ? ` ($${usdMonth.toLocaleString('en-US', { maximumFractionDigits: 2 })})` : ''}${budgetMonth ? ` of ${pkr(budgetMonth)} budget (${Math.round(adMonth / budgetMonth * 100)}%)` : ''}`);
  mkLines.push(`Running campaigns: ${running.length}${campLeads && adMonth ? ` · cost per lead ${pkr(adMonth / campLeads)}` : ''}`);
  over.forEach(c => urgentNotes.push(`Over budget: ${c.name} (${pkr(spendInMonth(c, month))} of ${pkr(budgetForMonth(c, month))})`));

  // ---------------- Team ----------------
  const teamLines: string[] = [];
  if (!isWorkingDay(date)) {
    teamLines.push('Sunday — office closed');
  } else {
    const rec = new Map(d.attendance.filter(a => a.date === date).map(a => [a.staffId, a]));
    const onLeaveIds = new Set(d.requests.filter(r => r.type === 'Leave' && r.status === 'Approved' && r.leaveStartDate <= date && r.leaveEndDate >= date).map(r => r.staffId));
    d.attendance.filter(a => a.date === date && a.onApprovedLeave).forEach(a => onLeaveIds.add(a.staffId));
    const present = activeStaff.filter(t => rec.get(t.id)?.checkIn);
    const late = present.filter(t => t.shiftStart && rec.get(t.id)!.checkIn > t.shiftStart);
    const onLeave = activeStaff.filter(t => !rec.get(t.id)?.checkIn && onLeaveIds.has(t.id));
    const absent = activeStaff.filter(t => !rec.get(t.id)?.checkIn && !onLeaveIds.has(t.id));
    teamLines.push(`Present: ${present.length} of ${activeStaff.length}`);
    if (late.length) teamLines.push(`Late: ${list(late.map(t => t.name.split(' ')[0]))}`);
    if (onLeave.length) teamLines.push(`On approved leave: ${list(onLeave.map(t => t.name.split(' ')[0]))}`);
    if (absent.length) teamLines.push(`Absent (no check-in): ${list(absent.map(t => t.name.split(' ')[0]), 6)}`);
    if (absent.length >= 3) urgentNotes.push(`${absent.length} staff have no check-in today`);
  }
  const pendingReq = d.requests.filter(r => r.status === 'Pending');
  if (pendingReq.length) teamLines.push(`Requests waiting for you: ${pendingReq.length} (${[...new Set(pendingReq.map(r => r.type))].join(', ')})`);

  // ---------------- Attention: payroll and month-end ----------------
  const prev = shiftMonth(month, -1);
  const run = d.payRuns.find(r => r.month === prev);
  const payDue = payrollDueDate(prev);
  const payDays = daysBetween(date, payDue);
  if (run?.status !== 'Paid' && payDays <= 5 && activeStaff.length) {
    urgentNotes.push(payDays < 0 ? `${monthLabel(prev)} salaries are ${-payDays} day(s) overdue (due ${shortDate(payDue)})` : payDays === 0 ? `${monthLabel(prev)} salaries are due today` : `${monthLabel(prev)} salaries are due in ${payDays} day(s) (${shortDate(payDue)})${run ? ` — payroll is ${run.status}` : ' — payroll not started'}`);
  }
  const hadActivityPrev = d.transactions.some(t => t.date.slice(0, 7) === prev);
  if (hadActivityPrev && !d.monthlyClosings.some(c => c.month === prev)) {
    const cd = daysBetween(date, closingDueDate(prev));
    if (cd <= 3) urgentNotes.push(cd < 0 ? `${monthLabel(prev)} closing is ${-cd} day(s) overdue` : `${monthLabel(prev)} closing is due ${cd === 0 ? 'today' : `in ${cd} day(s)`}`);
  }

  const sections: ReportSection[] = [
    { key: 'leads', icon: '📥', heading: 'Leads', lines: leadLines },
    { key: 'cases', icon: '📁', heading: 'Cases', lines: caseLines },
    { key: 'money', icon: '💰', heading: 'Money', lines: moneyLines },
    { key: 'marketing', icon: '📣', heading: 'Marketing', lines: mkLines },
    { key: 'team', icon: '👥', heading: 'Team', lines: teamLines },
    { key: 'attention', icon: '⚠️', heading: 'Needs your attention', lines: urgentNotes.length ? urgentNotes : ['Nothing urgent today'] },
  ];
  const dateLabel = labelDate(date);
  const text = [`*GoGlobe — Daily Report*`, dateLabel, '']
    .concat(...sections.map(s => [`*${s.icon} ${s.heading}*`, ...s.lines.map(l => `• ${l}`), '']))
    .join('\n').trim();
  const oneLine = (s: ReportSection) => s.lines.join(' · ').replace(/\s+/g, ' ').slice(0, 480);
  return { date, dateLabel, sections, text, vars: [dateLabel, ...sections.map(oneLine)], urgent: urgentNotes.length };
}

// The text of the WhatsApp template to create once in Meta's WhatsApp Manager
// (category "Utility"). WhatsApp does not allow a variable at the very start or
// end of the text, hence the opening and closing sentences.
export type TemplateStyle = 'detailed' | 'compact';

export const TEMPLATE_BODIES: Record<TemplateStyle, string> = {
  detailed: `Good evening. Here is the GoGlobe Ops daily report for {{1}}.

Leads: {{2}}

Cases: {{3}}

Money: {{4}}

Marketing: {{5}}

Team: {{6}}

Needs your attention: {{7}}

Open the portal for the full details.`,
  compact: `Here is your GoGlobe Ops daily report: {{1}} Open the portal for the full details.`,
};

// The values that fill the template. Variables may not contain new lines.
export function templateVars(r: DailyReport, style: TemplateStyle): string[] {
  if (style === 'compact') {
    const all = `${r.dateLabel}. ` + r.sections.map(s => `${s.heading}: ${s.lines.join(' · ')}`).join(' | ');
    return [all.replace(/\s+/g, ' ').slice(0, 900)];
  }
  return r.vars;
}
