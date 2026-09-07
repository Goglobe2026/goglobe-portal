'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { overallPaid } from './Cases';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { TeamMember } from '@/lib/types';

function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

export function MyPortal() {
  const { session, team, leads, cases, transactions, attendance, setAttendance, adjustments, requests, setRequests } = useAppData();
  const toast = useToast();
  const [showRequest, setShowRequest] = useState(false);
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
    else setAttendance(prev => [...prev, { id: genId('at'), staffId: t.id, date: today(), checkIn: nowTime(), checkOut: '' }]);
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
            <MiniMetric label={`Commission (${t.commissionPercent}%)`} value={money(commissionEarned)} note={`${money(commissionPaid)} already paid`} />
            <MiniMetric label={`Bonus (${money(t.bonusPerClose)}/close)`} value={money(bonusEarned)} note={`${money(bonusPaid)} already paid`} />
          </div>
          <SectionHead title="My leads" count={String(myLeads.length)} />
          <div className="card p-0 overflow-auto">
            <table><thead><tr><th>Name</th><th>Destination</th><th>Stage</th></tr></thead>
              <tbody>
                {myLeads.length ? myLeads.map(l => (
                  <tr key={l.id}><td className="font-medium">{l.name}</td><td>{l.destination}</td><td><Stamp text={l.stage} /></td></tr>
                )) : <tr><td colSpan={3} className="text-[var(--muted)] p-3.5">No leads assigned yet.</td></tr>}
              </tbody>
            </table>
          </div>
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

  function save() {
    if (!details.trim()) { toast('Enter some details'); return; }
    setRequests(prev => [...prev, { id: genId('rq'), staffId, type, details, date: today(), status: 'Pending', managerNote: '' }]);
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
      <Field label="Details"><textarea rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe your request" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Submit</button>
      </ModalFoot>
    </>
  );
}
