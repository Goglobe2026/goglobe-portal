'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today, LEAD_STAGES } from '@/lib/constants';
import { overallPaid } from './Cases';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { TeamMember, Lead } from '@/lib/types';

function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function waLink(phone: string, text: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function isOverdue(l: Lead) { return !!l.nextFollowUp && l.nextFollowUp <= today() && !['Converted', 'Lost'].includes(l.stage); }

export function MyPortal() {
  const { session, team, leads, setLeads, cases, transactions, attendance, setAttendance, adjustments, requests, setRequests } = useAppData();
  const toast = useToast();
  const [showRequest, setShowRequest] = useState(false);
  const [msgLeadId, setMsgLeadId] = useState<string | null>(null);
  const staffId = session?.type === 'employee' ? session.staffId : '';
  const found = team.find(x => x.id === staffId);
  if (!found) return <div className="card text-center p-8 text-[var(--muted)]">Staff record not found. Please log out and back in.</div>;
  const t: TeamMember = found;

  const isSales = t.department === 'Sales';
  const myLeads = leads.filter(l => l.assignedTo === t.id);
  const myCases = cases.filter(c => c.consultant === t.id);
  const won = myCases.filter(c => c.status === 'Approved').length;
  const revenue = myCases.reduce((s, c) => s + overallPaid(c), 0);
  const totalPipeline = myLeads.length + myCases.length;
  const rate = totalPipeline ? Math.round((won / totalPipeline) * 100) : 0;
  const commissionEarned = Math.round(revenue * (t.commissionPercent / 100));
  const commissionPaid = transactions.filter(x => x.category === 'Commission' && x.party === t.name).reduce((s, x) => s + x.amount, 0);
  const thisMonth = today().slice(0, 7);
  const closedThisMonth = myCases.filter(c => c.status === 'Approved' && c.createdAt.slice(0, 7) === thisMonth).length;
  const quota = t.monthlyQuota || 5;
  const quotaMet = closedThisMonth >= quota;
  const bonusEarned = won * t.bonusPerClose;
  const bonusPaid = transactions.filter(x => x.category === 'Bonus' && x.party === t.name).reduce((s, x) => s + x.amount, 0);
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
      <div className="card text-white" style={{ background: 'linear-gradient(135deg,#14213D,#1B3358)', border: 'none' }}>
        <div className="font-display text-xl font-semibold">{t.name}</div>
        <div className="text-[12.5px] opacity-85 mt-0.5">{t.role} · {t.department} · {t.employeeId}</div>
        <div className="font-mono-ui text-[11.5px] opacity-75 mt-1">Shift {t.shiftStart}–{t.shiftEnd} · {t.phone}</div>
      </div>

      <SectionHead title="Job description" />
      <div className="card text-[13px] leading-relaxed">{jd}</div>

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
            <MiniMetric label="Cases closed" value={String(won)} note={`of ${myCases.length} handled`} />
            <MiniMetric label="Revenue collected" value={money(revenue)} />
            <MiniMetric label="Conversion ratio" value={`${rate}%`} />
          </div>
          <SectionHead title="My earnings" />
          <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
            <MiniMetric label="Base salary" value={money(t.salary)} />
            <MiniMetric label={`Commission (${t.commissionPercent}%)`} value={quotaMet ? money(commissionEarned) : `Locked`} note={quotaMet ? `${money(commissionPaid)} already paid` : `Close ${quota - closedThisMonth} more case${quota - closedThisMonth === 1 ? '' : 's'} this month to unlock`} />
            <MiniMetric label={`Bonus (${money(t.bonusPerClose)}/close)`} value={money(bonusEarned)} note={`${money(bonusPaid)} already paid`} />
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
          <SectionHead title="My earnings" />
          <div className="card" style={{ maxWidth: 280 }}><MiniMetric label="Base salary" value={money(t.salary)} /></div>
        </>
      )}

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

      <SectionHead title="My requests" count="leave, advance, or anything else for the CEO" action={
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
  const { cases, setCases, team, logActivity } = useAppData();
  const toast = useToast();
  const awaiting = cases.filter(c => c.caseStage === 'Manager Review');
  const consultantName = (id: string) => team.find(t => t.id === id)?.name || 'Unassigned';

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
      {cases.length > 15 && <div className="text-[11.5px] text-[var(--faint)] -mt-3 mb-4">Showing the 15 most recent — ask the CEO for the full Cases view if you need to see everything.</div>}
    </>
  );
}

function DepartmentSnapshot({ department }: { department: string }) {
  const { campaigns, cases, transactions, appointments, team, leads } = useAppData();
  if (department === 'Marketing') {
    const spend = campaigns.reduce((s, c) => s + c.spend, 0);
    const camLeads = leads.filter(l => l.campaign);
    const cpl = camLeads.length ? Math.round(spend / camLeads.length) : 0;
    return (
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <MiniMetric label="Campaigns running" value={String(campaigns.length)} />
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
