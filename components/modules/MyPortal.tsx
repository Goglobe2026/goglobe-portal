'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today, LEAD_STAGES } from '@/lib/constants';
import { overallPaid } from './Cases';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import { AnnouncementsPanel } from './Announcements';
import { MyPerfCard } from './PerfWatch';
import { TeamMessages } from './TeamMessages';
import { unreadFor } from '@/lib/messages';
import { PayslipHistory, lineNet } from './Payroll';
import type { TeamMember, Lead } from '@/lib/types';
import { totalSpend, campaignStatus } from '@/lib/campaigns';
import { closerOf, casesClosedBy, collectedFor, dueCaseBonuses, payrollDueDate, shiftMonth, monthLabel, PAYROLL_DAY } from '@/lib/finance';

function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function waLink(phone: string, text: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function isOverdue(l: Lead) { return !!l.nextFollowUp && l.nextFollowUp <= today() && !['Converted', 'Lost'].includes(l.stage); }

export function MyPortal() {
  const { session, team, leads, setLeads, cases, transactions, attendance, setAttendance, adjustments, requests, setRequests, playbook, staffTargets, payRuns } = useAppData();
  const toast = useToast();
  const [showRequest, setShowRequest] = useState(false);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [msgLeadId, setMsgLeadId] = useState<string | null>(null);
  const [slipsOpen, setSlipsOpen] = useState(false);
  const staffId = session?.type === 'employee' ? session.staffId : '';
  const found = team.find(x => x.id === staffId);
  if (!found) return <div className="card text-center p-8 text-[var(--muted)]">Staff record not found. Please log out and back in.</div>;
  const t: TeamMember = found;

  const isSales = t.department === 'Sales';
  const myLeads = leads.filter(l => l.assignedTo === t.id);
  const myCases = cases.filter(c => c.consultant === t.id);
  // "Closed" follows the closing employee and date recorded on each case.
  const closedAll = cases.filter(c => closerOf(c) === t.id);
  const won = closedAll.length;
  const revenue = closedAll.reduce((s, c) => s + overallPaid(c), 0);
  const totalPipeline = myLeads.length + myCases.length;
  const rate = totalPipeline ? Math.round((won / totalPipeline) * 100) : 0;
  const thisMonth = today().slice(0, 7);
  const closedThisMonth = casesClosedBy(cases, t.id, thisMonth).length;
  const collectedThisMonth = collectedFor(cases, transactions, t.id, thisMonth);
  const commissionThisMonth = Math.round(collectedThisMonth * (t.commissionPercent / 100));
  const quota = t.monthlyQuota || 5;
  const quotaMet = closedThisMonth >= quota;
  const myCaseBonuses = dueCaseBonuses(cases, t.id, thisMonth);
  const bonusThisMonth = closedThisMonth * t.bonusPerClose + myCaseBonuses.reduce((s, x) => s + x.bonus.amount, 0);
  // Salary for a month is paid on the 5th of the next month.
  const lastMonthKey = shiftMonth(thisMonth, -1);
  const nextPay = today() <= payrollDueDate(lastMonthKey) ? { date: payrollDueDate(lastMonthKey), month: lastMonthKey } : { date: payrollDueDate(thisMonth), month: thisMonth };
  const myTarget = staffTargets.find(x => x.staffId === t.id && x.month === thisMonth);
  const myPayslips = payRuns.filter(r => r.status !== 'Draft')
    .flatMap(r => r.lines.filter(l => l.staffId === t.id).map(l => ({ run: r, line: l })))
    .sort((a, b) => b.run.month.localeCompare(a.run.month));
  const myAdj = [...adjustments.filter(a => a.staffId === t.id)].sort((a, b) => b.date.localeCompare(a.date));
  const rec = attendance.find(a => a.staffId === t.id && a.date === today());
  const myAttendance = attendance.filter(a => a.staffId === t.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const myRequests = [...requests.filter(r => r.staffId === t.id)].sort((a, b) => b.date.localeCompare(a.date));
  const jd = t.jobDescription || {
    Sales: 'Handle inbound leads end-to-end: qualify enquiries, guide clients through document collection, log every touchpoint, hit monthly closing targets, and hand off completed files to the manager for review.',
    Management: 'Review compiled case files and cover letters, approve or send back cases for correction, oversee appointment booking, and monitor overall pipeline health.',
    Documentation: 'Verify client documents against the country-specific checklist, flag missing or incorrect paperwork, and confirm every file is complete before manager review.',
    Marketing: 'Plan and run ad campaigns, track cost-per-lead and cost-per-close, and coordinate with sales on lead quality.',
    Accounts: 'Record payments, reconcile the ledger, chase outstanding balances, and process payroll, commission and bonus runs.',
    Admin: 'Manage front-desk operations, coordinate scheduling logistics, and support day-to-day office administration.',
  }[t.department];

  function checkIn() {
    const existing = attendance.find(a => a.staffId === t.id && a.date === today());
    if (existing) setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, checkIn: nowTime() } : a));
    else setAttendance(prev => [...prev, { id: genId('at'), staffId: t.id, date: today(), checkIn: nowTime(), checkOut: '', onApprovedLeave: false }]);
    toast('Checked in');
  }
  function checkOut() {
    const existing = attendance.find(a => a.staffId === t.id && a.date === today());
    if (existing) setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, checkOut: nowTime() } : a));
    toast('Checked out');
  }

  return (
    <div>
      <AnnouncementsPanel dept={t.department} />
      <div className="card text-white" style={{ background: 'linear-gradient(135deg,#14213D,#1B3358)', border: 'none' }}>
        <div className="font-display text-xl font-semibold">{t.name}</div>
        <div className="text-[12.5px] opacity-85 mt-0.5">{t.role} · {t.department} · {t.employeeId}</div>
        <div className="font-mono-ui text-[11.5px] opacity-75 mt-1">Shift {t.shiftStart}–{t.shiftEnd} · {t.phone}</div>
      </div>

      {myLeads.filter(isOverdue).length > 0 && (
        <div className="card mb-3.5" style={{ background: 'var(--red-50)', border: '1px solid var(--red)' }}>
          <div className="text-[13px] font-semibold" style={{ color: 'var(--red)' }}>
            You have {myLeads.filter(isOverdue).length} lead{myLeads.filter(isOverdue).length === 1 ? '' : 's'} due for follow-up — check "My leads" below.
          </div>
        </div>
      )}

      <MyPerfCard staffId={t.id} />

      <MyMessagesSection staffId={t.id} />

      <SectionHead title="Job description" />
      <div className="card text-[13px] leading-relaxed">{jd}</div>

      {playbook && (
        <>
          <SectionHead title="Company playbook" count="how we work — responsibilities, follow-up, sales approach" action={
            <button className="btn btn-sm ml-auto" onClick={() => setShowPlaybook(!showPlaybook)}>{showPlaybook ? 'Hide' : 'View'}</button>
          } />
          {showPlaybook && <div className="card text-[13px] whitespace-pre-wrap mb-4" style={{ lineHeight: 1.6 }}>{playbook}</div>}
        </>
      )}

      <SectionHead title="Today's attendance" />
      <div className="card flex justify-between items-center flex-wrap gap-3">
        <div className="flex gap-6">
          <div><div className="text-[11.5px] uppercase text-[var(--muted)] font-semibold">Check-in</div><div className="font-display text-[19px] font-semibold mt-1">{rec?.checkIn || '—'}</div></div>
          <div><div className="text-[11.5px] uppercase text-[var(--muted)] font-semibold">Check-out</div><div className="font-display text-[19px] font-semibold mt-1">{rec?.checkOut || '—'}</div></div>
        </div>
        <div className="flex gap-2">
          {!rec?.checkIn && <button className="btn btn-primary btn-sm" onClick={checkIn}>Check in now</button>}
          {rec?.checkIn && !rec?.checkOut && <button className="btn btn-sm" onClick={checkOut}>Check out now</button>}
          {rec?.checkIn && rec?.checkOut && <Stamp text="Completed" />}
        </div>
      </div>

      {isSales ? (
        <>
          <SectionHead title="My performance" />
          <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
            <MiniMetric label="Leads collected" value={String(myLeads.length)} />
            <MiniMetric label="Cases closed" value={String(won)} note={`${closedThisMonth} this month · ${myCases.length} handled`} />
            <MiniMetric label="Revenue collected" value={money(revenue)} />
            <MiniMetric label="Conversion ratio" value={`${rate}%`} />
          </div>
          <SectionHead title="My earnings" count={`Next payday: ${fmtDate(nextPay.date)} (${monthLabel(nextPay.month)} salary)`} />
          <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
            <MiniMetric label="Base salary" value={money(t.salary)} />
            {t.monthlyAllowance > 0 && <MiniMetric label="Monthly allowance" value={money(t.monthlyAllowance)} />}
            <MiniMetric label={`Collected this month`} value={money(collectedThisMonth)} note="on cases you closed" />
            <MiniMetric label={`Commission (${t.commissionPercent}%) this month`} value={quotaMet ? money(commissionThisMonth) : `Locked`} note={quotaMet ? 'paid with payroll' : `Close ${quota - closedThisMonth} more case${quota - closedThisMonth === 1 ? '' : 's'} this month to unlock`} />
            <MiniMetric label={`Bonuses this month`} value={money(bonusThisMonth)} note={`${closedThisMonth} closed × ${money(t.bonusPerClose)}${myCaseBonuses.length ? ` + ${myCaseBonuses.length} case bonus${myCaseBonuses.length === 1 ? '' : 'es'}` : ''}`} />
          </div>
          <SectionHead title="My leads" count={`${myLeads.length} — ${myLeads.filter(isOverdue).length} due for follow-up`} />
          <div className="card p-0 overflow-auto">
            <table><thead><tr><th>Name</th><th>Destination</th><th>Stage</th><th>Next follow-up</th><th>Messages</th><th></th></tr></thead>
              <tbody>
                {myLeads.length ? myLeads.map(l => {
                  const overdue = isOverdue(l);
                  return (
                    <tr key={l.id} style={overdue ? { background: 'var(--red-50)' } : undefined}>
                      <td className="font-medium">{l.name}<div className="font-mono-ui text-xs text-[var(--muted)]">{l.phone}</div></td>
                      <td>{l.destination}</td>
                      <td>
                        <select className="border-none bg-transparent font-medium p-0.5" value={l.stage} onChange={e => setLeads(prev => prev.map(x => x.id === l.id ? { ...x, stage: e.target.value as Lead['stage'] } : x))}>
                          {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="date" className="font-mono-ui !w-36" value={l.nextFollowUp || ''} onChange={e => setLeads(prev => prev.map(x => x.id === l.id ? { ...x, nextFollowUp: e.target.value } : x))} />
                        {overdue && <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--red)' }}>Overdue</div>}
                      </td>
                      <td><button className="btn btn-sm btn-ghost" onClick={() => setMsgLeadId(l.id)}>{l.messages.length} logged</button></td>
                      <td>
                        <a className="btn btn-sm" style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff' }} target="_blank"
                          href={waLink(l.phone, `Hello ${l.name}, this is GoGlobe Consultant regarding your ${l.destination} visa enquiry.`)}>WhatsApp</a>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={6} className="text-[var(--muted)] p-3.5">No leads assigned yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="text-[11.5px] text-[var(--faint)] -mt-3 mb-3.5">Pick a follow-up date when you speak to someone — it'll show up on the calendar and remind you when it's due.</div>
          <SectionHead title="My cases" count={String(myCases.length)} />
          <div className="card p-0 overflow-auto">
            <table><thead><tr><th>Client</th><th>Destination</th><th>Case stage</th><th>Status</th><th>Documents</th></tr></thead>
              <tbody>
                {myCases.length ? myCases.map(c => {
                  const v = c.documents.filter(d => d.status === 'Verified').length;
                  return <tr key={c.id}><td className="font-medium">{c.name}</td><td>{c.destination}</td><td>{c.caseStage}</td><td><Stamp text={c.status} /></td><td className="font-mono-ui text-xs">{v}/{c.documents.length} verified</td></tr>;
                }) : <tr><td colSpan={5} className="text-[var(--muted)] p-3.5">No cases assigned yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <SectionHead title="My department tasks" />
          <DepartmentSnapshot department={t.department} />
          {t.department === 'Management' && <ManagerReviewQueue />}
          <SectionHead title="My earnings" count={`Next payday: ${fmtDate(nextPay.date)} (${monthLabel(nextPay.month)} salary)`} />
          <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
            <MiniMetric label="Base salary" value={money(t.salary)} />
            {t.monthlyAllowance > 0 && <MiniMetric label="Monthly allowance" value={money(t.monthlyAllowance)} />}
            {myCaseBonuses.length > 0 && <MiniMetric label="Case bonuses waiting for payroll" value={money(myCaseBonuses.reduce((s, x) => s + x.bonus.amount, 0))} note={myCaseBonuses.map(x => x.caseRec.name).join(', ')} />}
          </div>
        </>
      )}

      {(myTarget || isSales) && (
        <>
          <SectionHead title={`My targets — ${monthLabel(thisMonth)}`} count="set by management, updates as you close and collect" />
          {myTarget && (myTarget.casesTarget > 0 || myTarget.revenueTarget > 0) ? (
            <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
              {myTarget.casesTarget > 0 && <TargetCard label="Cases to close" done={closedThisMonth} target={myTarget.casesTarget} fmt={n => String(n)} />}
              {myTarget.revenueTarget > 0 && <TargetCard label="Revenue to collect" done={collectedThisMonth} target={myTarget.revenueTarget} fmt={money} />}
            </div>
          ) : <div className="card text-[13px] text-[var(--muted)]">No target has been set for this month yet.</div>}
        </>
      )}

      <SectionHead title="My payslips" count={myPayslips.length ? `${myPayslips.length} issued` : 'issued after each monthly payroll'} action={
        myPayslips.length ? <button className="btn btn-sm ml-auto" onClick={() => setSlipsOpen(true)}>View / print payslips</button> : undefined
      } />
      <div className="card p-0 overflow-auto">
        <table><thead><tr><th>Salary month</th><th>Payroll day</th><th>Net pay</th><th>Status</th></tr></thead>
          <tbody>
            {myPayslips.length ? myPayslips.slice(0, 4).map(({ run, line }) => (
              <tr key={line.id}>
                <td className="font-medium">{monthLabel(run.month)}</td>
                <td className="font-mono-ui text-xs">{fmtDate(run.dueDate || payrollDueDate(run.month))}</td>
                <td className="font-mono-ui text-xs">{money(lineNet(line))}</td>
                <td>{line.paid ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Paid {fmtDate(line.paidDate)}</span> : <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Approved — payment due</span>}</td>
              </tr>
            )) : <tr><td colSpan={4} className="text-[var(--muted)] p-3.5">Your first payslip will appear here after payroll is approved. Salary is paid on the {PAYROLL_DAY}th of the following month.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={slipsOpen} onClose={() => setSlipsOpen(false)} wide>
        {slipsOpen && <PayslipHistory staff={t} onClose={() => setSlipsOpen(false)} />}
      </Modal>

      <SectionHead title="Appreciation & fines" count={`${myAdj.length} entries`} />
      <div className="card p-0 overflow-auto">
        <table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reason</th></tr></thead>
          <tbody>
            {myAdj.length ? myAdj.map(a => (
              <tr key={a.id}>
                <td className="font-mono-ui text-xs">{fmtDate(a.date)}</td>
                <td><Stamp text={a.type === 'Bonus' ? 'Approved' : 'Refused'} /></td>
                <td className="font-mono-ui text-xs" style={{ color: a.type === 'Bonus' ? 'var(--green)' : 'var(--red)' }}>{a.type === 'Bonus' ? '+' : '-'}{money(a.amount)}</td>
                <td className="text-[var(--muted)]">{a.reason}</td>
              </tr>
            )) : <tr><td colSpan={4} className="text-[var(--muted)] p-3.5">None recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionHead title="My attendance history" count="last 14 entries" />
      <div className="card p-0 overflow-auto">
        <table><thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th></tr></thead>
          <tbody>
            {myAttendance.length ? myAttendance.map(a => (
              <tr key={a.id}><td className="font-mono-ui text-xs">{fmtDate(a.date)}</td><td className="font-mono-ui text-xs">{a.checkIn || '—'}</td><td className="font-mono-ui text-xs">{a.checkOut || '—'}</td></tr>
            )) : <tr><td colSpan={3} className="text-[var(--muted)] p-3.5">No attendance recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionHead title="My requests" count="leave, advance, or anything else for the Head Manager" action={
        <button className="btn btn-primary btn-sm ml-auto" onClick={() => setShowRequest(true)}>+ Submit request</button>
      } />
      <div className="card p-0 overflow-auto">
        <table><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Status</th></tr></thead>
          <tbody>
            {myRequests.length ? myRequests.map(r => (
              <tr key={r.id}>
                <td className="font-mono-ui text-xs">{fmtDate(r.date)}</td><td>{r.type}</td>
                <td className="text-[var(--muted)]">{r.details}{r.managerNote && <div className="font-mono-ui text-xs mt-0.5">Response: {r.managerNote}</div>}</td>
                <td><Stamp text={r.status} /></td>
              </tr>
            )) : <tr><td colSpan={4} className="text-[var(--muted)] p-3.5">No requests submitted yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={showRequest} onClose={() => setShowRequest(false)}>
        <RequestForm staffId={t.id} onClose={() => setShowRequest(false)} />
      </Modal>

      <Modal open={!!msgLeadId} onClose={() => setMsgLeadId(null)}>
        {msgLeadId && <MyMessageLog leadId={msgLeadId} onClose={() => setMsgLeadId(null)} />}
      </Modal>
    </div>
  );
}

function MyMessageLog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { leads, setLeads } = useAppData();
  const toast = useToast();
  const [text, setText] = useState(''); const [direction, setDirection] = useState<'In' | 'Out'>('Out');
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return null;

  function add() {
    if (!text.trim()) { toast('Enter a message'); return; }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, messages: [...l.messages, { date: today(), text, direction }] } : l));
    setText('');
  }

  return (
    <>
      <ModalTitle>Message log — {lead.name}</ModalTitle>
      <div className="max-h-64 overflow-auto mb-3.5">
        {lead.messages.length ? lead.messages.map((m, i) => (
          <div key={i} className="flex gap-2.5 py-2 border-b last:border-0 items-start" style={{ borderColor: 'var(--line)' }}>
            <Stamp text={m.direction === 'In' ? 'New' : 'Active'} />
            <span className="flex-1">{m.text}<div className="font-mono-ui text-xs mt-0.5">{m.date}</div></span>
          </div>
        )) : <div className="text-[var(--muted)] py-2.5">No messages logged yet.</div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Direction">
          <select value={direction} onChange={e => setDirection(e.target.value as 'In' | 'Out')}>
            <option value="Out">I called/messaged them</option>
            <option value="In">They contacted me</option>
          </select>
        </Field>
        <Field label="What happened"><input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Interested, will decide by Friday" /></Field>
      </div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={add}>Add to log</button>
      </ModalFoot>
    </>
  );
}

function TargetCard({ label, done, target, fmt }: { label: string; done: number; target: number; fmt: (n: number) => string }) {
  const pct = target > 0 ? Math.min(100, Math.round(done / target * 100)) : 0;
  const color = pct >= 100 ? '#0B6E4F' : pct >= 60 ? '#C9922E' : '#B5433A';
  return (
    <div className="card">
      <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[19px] font-semibold mt-1">{fmt(done)} <span className="text-[13px] text-[var(--muted)] font-normal">of {fmt(target)}</span></div>
      <div className="mt-2 flex items-center gap-2"><div style={{ flex: 1, height: 9, background: '#E7EEF0', borderRadius: 6 }}><div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: color }} /></div><b className="text-[13px]">{pct}%</b></div>
    </div>
  );
}

function MiniMetric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card">
      <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[22px] font-semibold mt-1.5">{value}</div>
      {note && <div className="text-[11.5px] text-[var(--faint)] mt-1">{note}</div>}
    </div>
  );
}

function ManagerReviewQueue() {
  const { cases, setCases, leads, team, logActivity } = useAppData();
  const toast = useToast();
  const awaiting = cases.filter(c => c.caseStage === 'Manager Review');
  const consultantName = (id: string) => team.find(t => t.id === id)?.name || 'Unassigned';

  const escalatedLeads = leads.filter(l => l.escalated && !l.escalationResolved);
  const staleLeads = leads.filter(l =>
    (!l.escalated || l.escalationResolved) &&
    ['New', 'Contacted', 'Qualified'].includes(l.stage) &&
    Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000) >= 7
  );

  function toggleCover(caseId: string) {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, coverLetterChecked: !c.coverLetterChecked } : c));
  }
  function approve(c: typeof cases[0]) {
    if (!c.coverLetterChecked) { toast('Check the cover letter box first'); return; }
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, managerApproved: true, caseStage: 'Appointment Booking' } : x));
    logActivity(`${c.name} — approved by manager`);
    toast('Approved — moved to appointment booking');
  }

  return (
    <>
      {(escalatedLeads.length > 0 || staleLeads.length > 0) && (
        <>
          <SectionHead title="Leads needing your attention" count={`${escalatedLeads.length} escalated · ${staleLeads.length} untouched a week or more`} />
          <div className="card p-0 overflow-auto mb-4">
            <table>
              <thead><tr><th>Client</th><th>Consultant</th><th>Why</th><th></th></tr></thead>
              <tbody>
                {escalatedLeads.map(l => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.name}</td>
                    <td>{consultantName(l.assignedTo)}</td>
                    <td className="text-[12.5px]" style={{ color: 'var(--gold)' }}>⚑ {l.escalationReason}</td>
                    <td></td>
                  </tr>
                ))}
                {staleLeads.map(l => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.name}</td>
                    <td>{consultantName(l.assignedTo)}</td>
                    <td className="text-[12.5px]" style={{ color: 'var(--red)' }}>{Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000)} days, no contact yet</td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionHead title="Cases awaiting your review" count={`${awaiting.length} in the queue`} />
      {!awaiting.length ? (
        <div className="card text-[13px] text-[var(--muted)] mb-4">Nothing waiting on you right now.</div>
      ) : (
        <div className="card p-0 overflow-auto mb-4">
          <table>
            <thead><tr><th>Client</th><th>Destination</th><th>Consultant</th><th>Cover letter</th><th></th></tr></thead>
            <tbody>
              {awaiting.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.destination} <span className="text-[var(--muted)] text-[11px]">{c.visaType}</span></td>
                  <td>{consultantName(c.consultant)}</td>
                  <td>
                    <label className="flex items-center gap-1.5 text-[12.5px]">
                      <input type="checkbox" className="!w-auto" checked={c.coverLetterChecked} onChange={() => toggleCover(c.id)} />
                      Reviewed
                    </label>
                  </td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => approve(c)}>Approve</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionHead title="Team pipeline" count={`${cases.length} cases across everyone`} />
      <div className="card p-0 overflow-auto mb-4">
        <table>
          <thead><tr><th>Client</th><th>Consultant</th><th>Stage</th><th>Status</th></tr></thead>
          <tbody>
            {cases.slice(0, 15).map(c => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>{consultantName(c.consultant)}</td>
                <td>{c.caseStage}</td>
                <td><Stamp text={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cases.length > 15 && <div className="text-[11.5px] text-[var(--faint)] -mt-3 mb-4">Showing the 15 most recent — ask the Head Manager for the full Cases view if you need to see everything.</div>}
    </>
  );
}

function DepartmentSnapshot({ department }: { department: string }) {
  const { campaigns, cases, transactions, appointments, team, leads } = useAppData();
  if (department === 'Marketing') {
    const spend = campaigns.reduce((s, c) => s + totalSpend(c), 0);
    const camLeads = leads.filter(l => l.campaign);
    const cpl = camLeads.length ? Math.round(spend / camLeads.length) : 0;
    return (
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <MiniMetric label="Campaigns running" value={String(campaigns.filter(c => campaignStatus(c) === 'Running').length)} />
        <MiniMetric label="Total ad spend" value={money(spend)} />
        <MiniMetric label="Avg. cost per lead" value={cpl ? money(cpl) : '—'} />
      </div>
    );
  }
  if (department === 'Documentation') {
    const pending = cases.reduce((s, c) => s + c.documents.filter(d => d.status !== 'Verified').length, 0);
    const casesNeedingWork = cases.filter(c => c.documents.some(d => d.status !== 'Verified')).length;
    return (
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <MiniMetric label="Documents to verify" value={String(pending)} />
        <MiniMetric label="Cases with open items" value={String(casesNeedingWork)} />
        <MiniMetric label="Total cases on file" value={String(cases.length)} />
      </div>
    );
  }
  if (department === 'Accounts') {
    const receivable = cases.reduce((s, c) => s + (c.fee + c.apptFee + c.consultFee - c.discount - (c.paid + c.apptPaid + c.consultPaid)), 0);
    const thisMonth = today().slice(0, 7);
    const incomeMonth = transactions.filter(x => x.type === 'Income' && x.date.slice(0, 7) === thisMonth).reduce((s, x) => s + x.amount, 0);
    return (
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <MiniMetric label="Accounts receivable" value={money(Math.max(0, receivable))} />
        <MiniMetric label="Income this month" value={money(incomeMonth)} />
        <MiniMetric label="Ledger entries" value={String(transactions.length)} />
      </div>
    );
  }
  if (department === 'Management') {
    const awaiting = cases.filter(c => c.caseStage === 'Manager Review').length;
    return (
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <MiniMetric label="Active cases" value={String(cases.filter(c => c.status === 'Active').length)} />
        <MiniMetric label="Awaiting your review" value={String(awaiting)} />
        <MiniMetric label="Total staff" value={String(team.length)} />
      </div>
    );
  }
  const todayAppts = appointments.filter(a => a.date === today()).length;
  return (
    <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
      <MiniMetric label="Appointments today" value={String(todayAppts)} />
      <MiniMetric label="Total staff on file" value={String(team.length)} />
      <MiniMetric label="Total leads on file" value={String(leads.length)} />
    </div>
  );
}

function RequestForm({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const { setRequests } = useAppData();
  const toast = useToast();
  const [type, setType] = useState<'Leave' | 'Salary advance' | 'Complaint' | 'Other'>('Leave');
  const [details, setDetails] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState(today());
  const [leaveEndDate, setLeaveEndDate] = useState(today());

  function save() {
    if (!details.trim()) { toast('Enter some details'); return; }
    setRequests(prev => [...prev, {
      id: genId('rq'), staffId, type, details, date: today(), status: 'Pending', managerNote: '',
      leaveStartDate: type === 'Leave' ? leaveStartDate : '', leaveEndDate: type === 'Leave' ? leaveEndDate : '',
    }]);
    toast('Request submitted');
    onClose();
  }

  return (
    <>
      <ModalTitle>Submit a request</ModalTitle>
      <Field label="Type">
        <select value={type} onChange={e => setType(e.target.value as any)}>
          {['Leave', 'Salary advance', 'Complaint', 'Other'].map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      {type === 'Leave' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input type="date" value={leaveStartDate} onChange={e => setLeaveStartDate(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={leaveEndDate} onChange={e => setLeaveEndDate(e.target.value)} /></Field>
        </div>
      )}
      <Field label="Details"><textarea rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe your request" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Submit</button>
      </ModalFoot>
    </>
  );
}


// Private chat with the Head Manager and colleagues, kept closed until opened.
function MyMessagesSection({ staffId }: { staffId: string }) {
  const { messages } = useAppData();
  const [open, setOpen] = useState(false);
  const unread = unreadFor(messages, staffId);
  return (
    <>
      <SectionHead title="Team messages" count="private — only you and the other person can read a chat" action={
        <button className="btn btn-sm" onClick={() => setOpen(o => !o)}>{open ? 'Hide messages' : unread ? `Open messages (${unread} new)` : 'Open messages'}</button>
      } />
      {!open && unread > 0 && <div className="card mb-3.5" style={{ background: 'var(--gold-50)' }}><span className="text-[13px] font-semibold">You have {unread} unread message{unread === 1 ? '' : 's'}.</span></div>}
      {open && <div className="mb-3.5"><TeamMessages embedded /></div>}
    </>
  );
}
