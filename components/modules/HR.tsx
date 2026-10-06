'use client';
import { useState } from 'react';
import { printSheet } from '@/lib/printSheet';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today, DEPARTMENTS, JOB_DESCRIPTIONS } from '@/lib/constants';
import { overallPaid } from './Cases';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { TeamMember, SalarySlip } from '@/lib/types';
import { LOGO_FULL } from '@/lib/logo';
import { rupeesInWords } from '@/lib/moneyWords';
import { monthLabel, shiftMonth } from '@/lib/finance';
import { readFileAsDataUrl, MAX_PDF_BYTES } from '@/lib/fileUpload';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export function HR() {
  const { team, requests, setRequests, cases, leads, transactions, attendance, setAttendance, clientFeedback, setClientFeedback, logActivity } = useAppData();
  const [formStaff, setFormStaff] = useState<TeamMember | 'new' | null>(null);
  const [pinReveal, setPinReveal] = useState<{ name: string; pin: string } | null>(null);
  const [adjustFor, setAdjustFor] = useState<{ staff: TeamMember; type: 'Bonus' | 'Fine' } | null>(null);
  const toast = useToast();

  function approveRequest(r: typeof requests[0]) {
    const emp = team.find(t => t.id === r.staffId);
    setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'Approved' } : x));
    logActivity(`Approved request from ${emp?.name} (${r.type})`);
    // For approved leave with dates, mark each day so it doesn't look like an
    // unexplained absence — a day covered here is never flagged for a fine.
    if (r.type === 'Leave' && r.leaveStartDate && r.leaveEndDate) {
      const start = new Date(r.leaveStartDate);
      const end = new Date(r.leaveEndDate);
      const newEntries: typeof attendance = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        const already = attendance.find(a => a.staffId === r.staffId && a.date === dateStr);
        if (!already) {
          newEntries.push({ id: genId('at'), staffId: r.staffId, date: dateStr, checkIn: '', checkOut: '', onApprovedLeave: true });
        }
      }
      if (newEntries.length) {
        setAttendance(prev => [...prev, ...newEntries]);
        toast(`Approved — marked ${newEntries.length} day(s) as on leave`);
      }
    }
  }

  const depts = DEPARTMENTS.filter(d => team.some(t => t.department === d));
  const sales = team.filter(t => t.department === 'Sales');

  function resetPin(t: TeamMember) {
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    // caller wires this via context below
    return newPin;
  }

  return (
    <div>
      <SectionHead title="Employee list" count={`${team.length} staff across ${depts.length} departments`} action={
        <button className="btn btn-primary ml-auto" onClick={() => setFormStaff('new')}>+ Add employee</button>
      } />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Name</th><th>Post / designation</th><th>Department</th><th>Category</th><th>Contract</th><th>Contact</th><th>PIN</th><th></th></tr></thead>
          <tbody>
            {team.map(t => (
              <tr key={t.id} style={t.employmentStatus && t.employmentStatus !== 'Active' && t.employmentStatus !== 'On Leave' ? { opacity: 0.55 } : undefined}>
                <td className="font-medium">
                  {t.name}{t.isAdmin && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1.5" style={{ background: 'var(--red)', color: '#fff' }}>ADMIN</span>}
                  <div className="font-mono-ui text-xs">{t.employeeId}</div>
                  {t.employmentStatus && t.employmentStatus !== 'Active' && (
                    <div className="mt-0.5"><Stamp text={t.employmentStatus} /></div>
                  )}
                </td>
                <td>{t.role}</td>
                <td><Stamp text={t.department} /></td>
                <td className="text-[12px]" style={{ color: t.performanceCategory === 'Top Performer' ? 'var(--gold)' : 'var(--muted)', fontWeight: t.performanceCategory === 'Top Performer' ? 600 : 400 }}>{t.performanceCategory || 'Standard'}</td>
                <td className="text-[12px]">{t.contractType}<div className="font-mono-ui text-[10.5px]">{fmtDate(t.contractStart)}{t.contractEnd ? ` – ${fmtDate(t.contractEnd)}` : ' – ongoing'}</div></td>
                <td className="font-mono-ui text-[11.5px]">{t.phone}<br />{t.email}</td>
                <td className="font-mono-ui">{t.pin}</td>
                <td>
                  <div className="flex gap-1.5 justify-end">
                    <button className="btn btn-sm" onClick={() => setFormStaff(t)}>Open profile</button>
                    <ResetPinButton staff={t} onReveal={setPinReveal} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHead title="Employee requests" count={`${requests.filter(r => r.status === 'Pending').length} pending of ${requests.length} total`} />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Details</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {[...requests].sort((a, b) => b.date.localeCompare(a.date)).map(r => {
              const emp = team.find(t => t.id === r.staffId);
              return (
                <tr key={r.id}>
                  <td className="font-mono-ui text-xs">{fmtDate(r.date)}</td>
                  <td className="font-medium">{emp?.name || '—'}</td>
                  <td>{r.type}</td>
                  <td className="text-[var(--muted)]">{r.details}{r.managerNote && <div className="font-mono-ui text-xs mt-0.5">Note: {r.managerNote}</div>}</td>
                  <td><Stamp text={r.status} /></td>
                  <td>
                    {r.status === 'Pending' && (
                      <div className="flex gap-1.5 justify-end">
                        <button className="btn btn-sm" onClick={() => approveRequest(r)}>Approve</button>
                        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => { setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'Rejected' } : x)); logActivity(`Rejected request from ${emp?.name} (${r.type})`); }}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!requests.length && <tr><td colSpan={6} className="text-[var(--muted)] p-3.5">No requests submitted yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionHead title="Client feedback" count={`${clientFeedback.length} received${clientFeedback.filter(f => f.moneyDemanded && !f.reviewedByCeo).length ? ` — ${clientFeedback.filter(f => f.moneyDemanded && !f.reviewedByCeo).length} need urgent attention` : ''}`} />
      {clientFeedback.filter(f => f.moneyDemanded).length > 0 && (
        <div className="card mb-3.5" style={{ background: 'var(--red-50)', border: '1px solid var(--red)' }}>
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--red)' }}>⚠ Client(s) reported being asked for money beyond the official invoice</div>
          {clientFeedback.filter(f => f.moneyDemanded).map(f => {
            const emp = team.find(t => t.id === f.consultantId);
            return (
              <div key={f.id} className="py-2 border-t first:border-0" style={{ borderColor: 'rgba(0,0,0,.08)' }}>
                <div className="text-[13px]"><b>{f.clientName}</b> ({f.caseReferenceCode}) — consultant: <b>{emp?.name || 'Unknown'}</b></div>
                {f.moneyDemandedDetails && <div className="text-[12.5px] mt-1" style={{ color: '#6b1010' }}>&quot;{f.moneyDemandedDetails}&quot;</div>}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-mono-ui text-[10.5px] text-[var(--faint)]">{fmtDate(f.submittedAt)}</span>
                  {!f.reviewedByCeo && <button className="btn btn-sm" onClick={() => setClientFeedback(prev => prev.map(x => x.id === f.id ? { ...x, reviewedByCeo: true } : x))}>Mark reviewed</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="card p-0 overflow-auto mb-4">
        <table>
          <thead><tr><th>Client</th><th>Consultant</th><th>Rating</th><th>Recommend?</th><th>Comment</th><th>Date</th></tr></thead>
          <tbody>
            {[...clientFeedback].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(f => {
              const emp = team.find(t => t.id === f.consultantId);
              return (
                <tr key={f.id}>
                  <td className="font-medium">{f.clientName}</td>
                  <td>{emp?.name || '—'}</td>
                  <td style={{ color: 'var(--gold)' }}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
                  <td>{f.wouldRecommend ? 'Yes' : 'No'}</td>
                  <td className="text-[12.5px]">{f.comment || '—'}</td>
                  <td className="font-mono-ui text-xs">{fmtDate(f.submittedAt)}</td>
                </tr>
              );
            })}
            {!clientFeedback.length && <tr><td colSpan={6} className="text-[var(--muted)] p-3.5">No client feedback received yet — clients can leave feedback from their case status page.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionHead title="Performance & payroll" count="by department" />
      {sales.length > 0 && (
        <div className="card" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sales.map(t => ({
              name: t.name,
              leads: leads.filter(l => l.assignedTo === t.id).length,
              closed: cases.filter(c => c.consultant === t.id && c.status === 'Approved').length,
            }))}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="leads" name="Leads collected" fill="var(--gold)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="closed" name="Cases closed" fill="var(--navy)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {depts.map(dept => (
        <div key={dept}>
          <SectionHead title={dept} count={String(team.filter(t => t.department === dept).length)} />
          <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
            {team.filter(t => t.department === dept).map(t => <StaffCard key={t.id} staff={t} onAdjust={(type) => setAdjustFor({ staff: t, type })} />)}
          </div>
        </div>
      ))}

      <PlaybookEditor />

      <Modal open={!!formStaff} onClose={() => setFormStaff(null)}>
        {formStaff && <EmployeeForm staff={formStaff === 'new' ? null : formStaff} onClose={() => setFormStaff(null)} />}
      </Modal>

      <Modal open={!!pinReveal} onClose={() => setPinReveal(null)}>
        {pinReveal && (
          <>
            <ModalTitle>PIN reset — {pinReveal.name}</ModalTitle>
            <div className="text-[12.5px] text-[var(--muted)] mb-3.5">Share this new PIN with {pinReveal.name} directly — the old one no longer works.</div>
            <div className="card text-center py-6">
              <div className="text-[11.5px] uppercase text-[var(--muted)] font-semibold">New Portal PIN</div>
              <div className="font-mono-ui text-[28px] font-bold mt-2" style={{ color: 'var(--navy)' }}>{pinReveal.pin}</div>
            </div>
            <ModalFoot><button className="btn btn-primary w-full" onClick={() => setPinReveal(null)}>Done</button></ModalFoot>
          </>
        )}
      </Modal>
      <Modal open={!!adjustFor} onClose={() => setAdjustFor(null)}>
        {adjustFor && <AdjustForm staff={adjustFor.staff} type={adjustFor.type} onClose={() => setAdjustFor(null)} />}
      </Modal>
    </div>
  );
}

function ResetPinButton({ staff, onReveal }: { staff: TeamMember; onReveal: (r: { name: string; pin: string }) => void }) {
  const { setTeam } = useAppData();
  const toast = useToast();
  function doReset() {
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    setTeam(prev => prev.map(t => t.id === staff.id ? { ...t, pin: newPin } : t));
    onReveal({ name: staff.name, pin: newPin });
    toast('PIN reset');
  }
  return <button className="btn btn-sm" onClick={doReset}>Reset PIN</button>;
}

function AdjustForm({ staff, type, onClose }: { staff: TeamMember; type: 'Bonus' | 'Fine'; onClose: () => void }) {
  const { setAdjustments, setTransactions, logActivity } = useAppData();
  const toast = useToast();
  const [amount, setAmount] = useState(0); const [reason, setReason] = useState('');

  function save() {
    if (amount <= 0) { toast('Enter an amount'); return; }
    setAdjustments(prev => [...prev, { id: genId('adj'), staffId: staff.id, type, amount, reason, date: today() }]);
    setTransactions(prev => [...prev, {
      id: genId('tx'), date: today(), type: type === 'Bonus' ? 'Expense' : 'Income',
      category: type === 'Bonus' ? 'Appreciation bonus' : 'Fine deduction', party: staff.name, amount, note: reason,
    }]);
    logActivity(`${type === 'Bonus' ? 'Appreciation bonus' : 'Fine'} — ${staff.name}, ${money(amount)}${reason ? ' (' + reason + ')' : ''}`);
    toast(type === 'Bonus' ? 'Appreciation bonus recorded' : 'Fine recorded');
    onClose();
  }

  return (
    <>
      <ModalTitle>{type === 'Bonus' ? 'Give appreciation bonus' : 'Apply fine'} — {staff.name}</ModalTitle>
      <Field label="Amount (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      <Field label="Reason"><input value={reason} onChange={e => setReason(e.target.value)} placeholder={type === 'Bonus' ? 'e.g. Closed 3 cases this week' : 'e.g. Missed client appointment'} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save {type.toLowerCase()}</button>
      </ModalFoot>
    </>
  );
}

function StaffCard({ staff: t, onAdjust }: { staff: TeamMember; onAdjust: (type: 'Bonus' | 'Fine') => void }) {
  const { leads, cases, transactions, team, setTeam, setTransactions, adjustments, requests, logActivity } = useAppData();
  const toast = useToast();
  const isSales = t.department === 'Sales';
  const myLeads = leads.filter(l => l.assignedTo === t.id).length;
  const myCases = cases.filter(c => c.consultant === t.id);
  const won = myCases.filter(c => c.status === 'Approved').length;
  const revenue = myCases.reduce((s, c) => s + overallPaid(c), 0);
  const total = myLeads + myCases.length;
  const rate = total ? Math.round((won / total) * 100) : 0;
  const commissionEarned = Math.round(revenue * (t.commissionPercent / 100));
  const commissionPaid = transactions.filter(x => x.category === 'Commission' && x.party === t.name).reduce((s, x) => s + x.amount, 0);
  const commissionDue = Math.max(0, commissionEarned - commissionPaid);
  const thisMonth = today().slice(0, 7);
  const closedThisMonth = myCases.filter(c => c.status === 'Approved' && c.createdAt.slice(0, 7) === thisMonth).length;
  const quota = t.monthlyQuota || 5;
  const quotaMet = closedThisMonth >= quota;
  const bonusEarned = won * t.bonusPerClose;
  const bonusPaid = transactions.filter(x => x.category === 'Bonus' && x.party === t.name).reduce((s, x) => s + x.amount, 0);
  const bonusDue = Math.max(0, bonusEarned - bonusPaid);
  const [slipsOpen, setSlipsOpen] = useState(false);
  const myAdj = adjustments.filter(a => a.staffId === t.id);
  const apprTotal = myAdj.filter(a => a.type === 'Bonus').reduce((s, a) => s + a.amount, 0);
  const fineTotal = myAdj.filter(a => a.type === 'Fine').reduce((s, a) => s + a.amount, 0);

  function payCommission() {
    setTransactions(prev => [...prev, { id: genId('tx'), date: today(), type: 'Expense', category: 'Commission', party: t.name, amount: commissionDue, note: 'Sales commission' }]);
    logActivity(`Commission paid — ${t.name}, ${money(commissionDue)}`);
    toast('Commission recorded');
  }
  function payBonus() {
    setTransactions(prev => [...prev, { id: genId('tx'), date: today(), type: 'Expense', category: 'Bonus', party: t.name, amount: bonusDue, note: 'Closed-case bonus' }]);
    logActivity(`Bonus paid — ${t.name}, ${money(bonusDue)}`);
    toast('Bonus recorded');
  }

  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <div><div className="font-display font-semibold text-[15px]">{t.name}</div><div className="text-[var(--muted)] text-xs">{t.role}</div></div>
        <span className="font-mono-ui text-[11px] text-[var(--faint)]">{t.employeeId}</span>
      </div>
      <div className="font-mono-ui text-[11.5px] text-[var(--faint)] my-1.5">{t.phone} · Shift {t.shiftStart}–{t.shiftEnd} · PIN {t.pin}</div>
      {isSales && (
        <>
          <Row label="Leads collected" value={String(myLeads)} />
          <Row label="Cases handled" value={String(myCases.length)} />
          <Row label="Leads closed" value={String(won)} />
          <Row label="Revenue collected" value={money(revenue)} />
          <Row label="Conversion ratio" value={`${rate}%`} last />
        </>
      )}
      <div className="pt-2.5 border-t" style={{ borderColor: 'var(--line)' }}>
        <Row label="Base salary" value={money(t.salary)} />
        {t.monthlyAllowance > 0 && <Row label="Monthly allowance" value={money(t.monthlyAllowance)} />}
        {isSales && <>
          <Row label={`This month's quota (${quota})`} value={`${closedThisMonth}/${quota} closed`} />
          <Row label="Commission due" value={quotaMet ? money(commissionDue) : `Locked — ${quota - closedThisMonth} more to unlock`} />
          <Row label="Bonus due" value={money(bonusDue)} />
        </>}
        {(apprTotal || fineTotal) ? <Row label="Appreciation / fines" value={`+${money(apprTotal)} / -${money(fineTotal)}`} last /> : null}
        <div className="flex gap-2 flex-wrap mt-2.5">
          <button className="btn btn-sm flex-1" onClick={() => setSlipsOpen(true)}>Salary slips</button>
          {isSales && quotaMet && commissionDue > 0 && <button className="btn btn-sm flex-1" onClick={payCommission}>Pay commission</button>}
          {isSales && bonusDue > 0 && <button className="btn btn-sm flex-1" onClick={payBonus}>Pay bonus</button>}
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-sm flex-1" style={{ color: 'var(--green)' }} onClick={() => onAdjust('Bonus')}>+ Appreciation</button>
          <button className="btn btn-sm flex-1" style={{ color: 'var(--red)' }} onClick={() => onAdjust('Fine')}>+ Fine</button>
        </div>
      </div>

      <Modal open={slipsOpen} onClose={() => setSlipsOpen(false)} wide>
        {slipsOpen && <SalarySlipsPanel staff={t} onClose={() => setSlipsOpen(false)} />}
      </Modal>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between text-[12.5px] ${last ? 'mb-3' : 'mb-1.5'}`}>
      <span className="text-[var(--muted)]">{label}</span><span className="font-mono-ui">{value}</span>
    </div>
  );
}

function EmployeeForm({ staff, onClose }: { staff: TeamMember | null; onClose: () => void }) {
  const { team, setTeam } = useAppData();
  const toast = useToast();
  const t = staff;
  const [name, setName] = useState(t?.name || ''); const [phone, setPhone] = useState(t?.phone || ''); const [email, setEmail] = useState(t?.email || '');
  const [department, setDepartment] = useState<TeamMember['department']>(t?.department || 'Sales'); const [role, setRole] = useState(t?.role || '');
  const [education, setEducation] = useState(t?.education || ''); const [experience, setExperience] = useState(t?.experience || '');
  const [contractType, setContractType] = useState<TeamMember['contractType']>(t?.contractType || 'Permanent');
  const [contractStart, setContractStart] = useState(t?.contractStart || today()); const [contractEnd, setContractEnd] = useState(t?.contractEnd || '');
  const [shiftStart, setShiftStart] = useState(t?.shiftStart || '10:00'); const [shiftEnd, setShiftEnd] = useState(t?.shiftEnd || '18:00');
  const [salary, setSalary] = useState(t?.salary || 0); const [commissionPercent, setCommissionPercent] = useState(t?.commissionPercent || 0); const [bonusPerClose, setBonusPerClose] = useState(t?.bonusPerClose || 0);
  const [jobDescription, setJobDescription] = useState(t?.jobDescription || '');
  const [employeeId, setEmployeeId] = useState(t?.employeeId || `GG-${String(team.length + 1).padStart(3, '0')}`);
  const [pin, setPin] = useState(t?.pin || String(1000 + team.length + 1));
  const [monthlyQuota, setMonthlyQuota] = useState(t?.monthlyQuota ?? 5);
  const [performanceCategory, setPerformanceCategory] = useState<TeamMember['performanceCategory']>(t?.performanceCategory || 'Standard');
  const [employmentStatus, setEmploymentStatus] = useState<TeamMember['employmentStatus']>(t?.employmentStatus || 'Active');
  const [isAdmin, setIsAdmin] = useState(t?.isAdmin || false);
  const [lastWorkingDay, setLastWorkingDay] = useState(t?.lastWorkingDay || '');
  const [monthlyAllowance, setMonthlyAllowance] = useState(t?.monthlyAllowance || 0);
  const [guardianName, setGuardianName] = useState(t?.guardianName || '');
  const [guardianPhone, setGuardianPhone] = useState(t?.guardianPhone || '');
  const [address, setAddress] = useState(t?.address || '');
  const [contractPdf, setContractPdf] = useState(t?.contractPdf || '');
  const [contractPdfName, setContractPdfName] = useState(t?.contractPdfName || '');

  function save() {
    if (!name.trim()) { toast('Enter a name'); return; }
    const data: TeamMember = {
      id: t?.id || `tm_${Date.now().toString(36)}`, name, phone, email, department, role: role || 'Staff',
      education, experience, contractType, contractStart, contractEnd, shiftStart, shiftEnd,
      salary, commissionPercent, bonusPerClose, jobDescription, employeeId, pin, lastSalaryPaid: t?.lastSalaryPaid || '',
      monthlyQuota, performanceCategory, employmentStatus, lastWorkingDay, monthlyAllowance,
      guardianName, guardianPhone, address, contractPdf, contractPdfName, isAdmin,
    };
    if (t) setTeam(prev => prev.map(x => x.id === t.id ? data : x));
    else setTeam(prev => [...prev, data]);
    toast(t ? 'Profile saved' : 'Employee added');
    onClose();
  }

  return (
    <>
      <ModalTitle>{t ? `Employee profile — ${t.name}` : 'Add new employee'}</ModalTitle>
      {t && (
        <>
          <SectionHead title="Employment status" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={employmentStatus} onChange={e => setEmploymentStatus(e.target.value as TeamMember['employmentStatus'])}>
                {(['Active', 'On Leave', 'Resigned', 'Terminated'] as const).map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            {employmentStatus !== 'Active' && employmentStatus !== 'On Leave' && (
              <Field label="Last working day"><input type="date" value={lastWorkingDay} onChange={e => setLastWorkingDay(e.target.value)} /></Field>
            )}
          </div>
          {employmentStatus !== 'Active' && (
            <div className="text-[11.5px] text-[var(--faint)] -mt-2 mb-3">
              {employmentStatus === 'On Leave'
                ? "They're temporarily unavailable — hidden from new lead/case assignment, but can still log in."
                : "Their full history (cases, payments, attendance) stays exactly as it is — they just can no longer log in, and won't show up when assigning new work."}
            </div>
          )}

          <div className="card mb-3" style={{ background: isAdmin ? 'var(--red-50)' : '#F7F9FC' }}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="!w-auto" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
              <span className="text-[13px] font-medium">Give this person full admin access</span>
            </label>
            <div className="text-[11.5px] mt-1.5" style={{ color: isAdmin ? '#8a2020' : 'var(--faint)' }}>
              This is the same as the CEO login — every module, every salary, every bank balance, and the ability to grant or remove this same access from anyone else, including you. Only turn this on for someone you'd trust with the owner's own PIN.
            </div>
          </div>
        </>
      )}
      <SectionHead title="Personal & contact details" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="Address"><input value={address} onChange={e => setAddress(e.target.value)} placeholder="Home address" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Guardian's name"><input value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="Father/husband/guardian" /></Field>
        <Field label="Guardian's contact"><input value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} /></Field>
      </div>
      <Field label="Employment contract (PDF, optional, under 4MB)">
        <input type="file" accept="application/pdf" onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.type !== 'application/pdf') { toast('Please choose a PDF file'); return; }
          if (file.size > MAX_PDF_BYTES) { toast('PDF is too large — please keep it under 4MB'); return; }
          const dataUrl = await readFileAsDataUrl(file);
          setContractPdf(dataUrl); setContractPdfName(file.name);
        }} />
        {contractPdfName && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11.5px]" style={{ color: 'var(--green)' }}>Attached: {contractPdfName}</span>
            <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => { setContractPdf(''); setContractPdfName(''); }}>Remove</button>
          </div>
        )}
      </Field>

      <SectionHead title="Post, designation & role assignment" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Department (role assignment)">
          <select value={department} onChange={e => setDepartment(e.target.value as TeamMember['department'])}>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select>
        </Field>
        <Field label="Post / designation"><input value={role} onChange={e => setRole(e.target.value)} /></Field>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] -mt-2 mb-3">Whichever department is selected here decides what shows in this person&apos;s own portal.</div>

      <SectionHead title="Education & experience" />
      <Field label="Education"><input value={education} onChange={e => setEducation(e.target.value)} /></Field>
      <Field label="Experience"><textarea rows={2} value={experience} onChange={e => setExperience(e.target.value)} /></Field>

      <SectionHead title="Contract" />
      <Field label="Contract type">
        <select value={contractType} onChange={e => setContractType(e.target.value as TeamMember['contractType'])}>
          {['Permanent', 'Contract', 'Probation', 'Part-time'].map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contract start"><input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} /></Field>
        <Field label="Contract end (blank if ongoing)"><input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} /></Field>
      </div>

      <SectionHead title="Duty timing & pay" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Shift start"><input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} /></Field>
        <Field label="Shift end"><input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly base salary (PKR)"><input type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} /></Field>
        <Field label="Monthly allowance (PKR)"><input type="number" value={monthlyAllowance} onChange={e => setMonthlyAllowance(Number(e.target.value))} /></Field>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] -mt-2 mb-3">Transport, communication, or any other fixed monthly amount — paid alongside salary, kept separate so it's clear what's base pay.</div>
      {department === 'Sales' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Commission (%)"><input type="number" value={commissionPercent} onChange={e => setCommissionPercent(Number(e.target.value))} /></Field>
          <Field label="Bonus per closed case (PKR)"><input type="number" value={bonusPerClose} onChange={e => setBonusPerClose(Number(e.target.value))} /></Field>
        </div>
      )}
      {department === 'Sales' && (
        <Field label="Monthly case quota before commission unlocks">
          <input type="number" value={monthlyQuota} onChange={e => setMonthlyQuota(Number(e.target.value))} />
        </Field>
      )}
      <Field label="Performance category">
        <select value={performanceCategory} onChange={e => setPerformanceCategory(e.target.value as TeamMember['performanceCategory'])}>
          {(['Junior', 'Standard', 'Senior', 'Top Performer'] as const).map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Job description (optional)"><textarea rows={2} value={jobDescription} onChange={e => setJobDescription(e.target.value)} /></Field>

      <SectionHead title="Portal account" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee ID"><input value={employeeId} onChange={e => setEmployeeId(e.target.value)} /></Field>
        <Field label="Portal PIN"><input value={pin} onChange={e => setPin(e.target.value)} maxLength={6} /></Field>
      </div>

      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{t ? 'Save changes' : 'Add employee'}</button>
      </ModalFoot>
    </>
  );
}

function PlaybookEditor() {
  const { playbook, setPlaybook } = useAppData();
  const toast = useToast();
  const [draft, setDraft] = useState(playbook);
  const [editing, setEditing] = useState(false);

  function save() {
    setPlaybook(draft);
    setEditing(false);
    toast('Playbook saved — every employee can now see this from their own portal');
  }

  return (
    <>
      <SectionHead title="Company playbook" count="responsibilities, follow-up mechanism, sales approach — visible to every employee" action={
        !editing && <button className="btn btn-sm ml-auto" onClick={() => { setDraft(playbook); setEditing(true); }}>{playbook ? 'Edit' : '+ Write it'}</button>
      } />
      {editing ? (
        <div className="card">
          <div className="text-[11.5px] text-[var(--faint)] mb-2">
            One shared document every employee can read from their own portal — responsibilities, how to run a follow-up, your sales approach, how you want clients handled, the points that actually convince someone to sign. Write it once here so every new hire has the same reference, in writing.
          </div>
          <textarea rows={16} value={draft} onChange={e => setDraft(e.target.value)} placeholder={"e.g.\n\nRESPONSIBILITIES\n...\n\nFOLLOW-UP MECHANISM\n...\n\nSALES APPROACH\n...\n\nCLIENT DEALING\n...\n\nKEY POINTS THAT CONVINCE CLIENTS\n..."} />
          <div className="flex gap-2 mt-2.5">
            <button className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={save}>Save playbook</button>
          </div>
        </div>
      ) : (
        <div className="card">
          {playbook ? (
            <div className="text-[13px] whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>{playbook}</div>
          ) : (
            <div className="text-[13px] text-[var(--muted)]">Nothing written yet — click &quot;+ Write it&quot; to create the reference document every employee will see in their own portal.</div>
          )}
        </div>
      )}
    </>
  );
}


// ---------------------------------------------------------------------
// Salary slips
// ---------------------------------------------------------------------
function SalarySlipsPanel({ staff, onClose }: { staff: TeamMember; onClose: () => void }) {
  const { salarySlips } = useAppData();
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [viewId, setViewId] = useState<string | null>(null);
  const mine = salarySlips.filter(s => s.staffId === staff.id).sort((a, b) => b.month.localeCompare(a.month));

  if (viewId) return <SalarySlipView slipId={viewId} onBack={() => setViewId(null)} />;
  if (mode === 'new') return <SalarySlipForm staff={staff} onCancel={() => setMode('list')} onCreated={id => { setMode('list'); setViewId(id); }} />;

  return (
    <>
      <ModalTitle>Salary slips — {staff.name}</ModalTitle>
      {mine.length === 0
        ? <div className="text-[15px] text-[var(--muted)] mb-4">No salary slip generated yet for this employee.</div>
        : <div className="flex flex-col gap-2 mb-4">
            {mine.map(s => (
              <button key={s.id} className="btn text-left flex items-center justify-between" style={{ fontSize: 15, padding: '12px 14px' }} onClick={() => setViewId(s.id)}>
                <span><b>{monthLabel(s.month)}</b> &nbsp;·&nbsp; {s.slipNumber}</span>
                <span>{money(s.netPay)} &nbsp;
                  <span style={{ color: s.status === 'Paid' ? 'var(--green)' : '#B5433A', fontWeight: 600 }}>{s.status === 'Paid' ? `Paid ${fmtDate(s.paidDate)}` : 'Not paid yet'}</span>
                </span>
              </button>
            ))}
          </div>}
      <ModalFoot>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => setMode('new')}>+ New salary slip</button>
      </ModalFoot>
    </>
  );
}

function SalarySlipForm({ staff: t, onCancel, onCreated }: { staff: TeamMember; onCancel: () => void; onCreated: (id: string) => void }) {
  const { cases, transactions, adjustments, salarySlips, setSalarySlips, logActivity } = useAppData();
  const toast = useToast();
  const todayStr = today();
  // Salary for a month is normally prepared in the first days of the next
  // month, so early in the month we default to the month that just ended.
  const currentMonth = todayStr.slice(0, 7);
  const initialMonth = Number(todayStr.slice(8, 10)) <= 15 ? shiftMonth(currentMonth, -1) : currentMonth;
  const monthOptions = [0, -1, -2, -3, -4, -5].map(d => shiftMonth(currentMonth, d));

  const myCases = cases.filter(c => c.consultant === t.id);
  const won = myCases.filter(c => c.status === 'Approved').length;
  const revenue = myCases.reduce((s, c) => s + overallPaid(c), 0);
  const commissionEarned = Math.round(revenue * (t.commissionPercent / 100));
  const commissionPaid = transactions.filter(x => x.category === 'Commission' && x.party === t.name).reduce((s, x) => s + x.amount, 0);
  const bonusEarned = won * t.bonusPerClose;
  const bonusPaid = transactions.filter(x => x.category === 'Bonus' && x.party === t.name).reduce((s, x) => s + x.amount, 0);
  const quota = t.monthlyQuota || 5;

  function defaultsFor(m: string) {
    const adj = adjustments.filter(a => a.staffId === t.id && a.date.slice(0, 7) === m);
    const closedInMonth = myCases.filter(c => c.status === 'Approved' && c.createdAt.slice(0, 7) === m).length;
    const quotaMet = t.department !== 'Sales' || closedInMonth >= quota;
    return {
      base: t.salary, allowance: t.monthlyAllowance || 0,
      commission: quotaMet ? Math.max(0, commissionEarned - commissionPaid) : 0,
      bonus: Math.max(0, bonusEarned - bonusPaid),
      appreciation: adj.filter(a => a.type === 'Bonus').reduce((s, a) => s + a.amount, 0),
      fines: adj.filter(a => a.type === 'Fine').reduce((s, a) => s + a.amount, 0),
      quotaMet, closedInMonth,
    };
  }
  const d0 = defaultsFor(initialMonth);
  const [month, setMonth] = useState(initialMonth);
  const [base, setBase] = useState(d0.base); const [allowance, setAllowance] = useState(d0.allowance);
  const [commission, setCommission] = useState(d0.commission); const [bonus, setBonus] = useState(d0.bonus);
  const [appreciation, setAppreciation] = useState(d0.appreciation); const [fines, setFines] = useState(d0.fines);
  const [quotaNote, setQuotaNote] = useState(!d0.quotaMet ? d0.closedInMonth : -1);

  function changeMonth(m: string) {
    const d = defaultsFor(m);
    setMonth(m); setBase(d.base); setAllowance(d.allowance); setCommission(d.commission); setBonus(d.bonus);
    setAppreciation(d.appreciation); setFines(d.fines); setQuotaNote(!d.quotaMet ? d.closedInMonth : -1);
  }

  const net = base + allowance + commission + bonus + appreciation - fines;
  const existing = salarySlips.find(s => s.staffId === t.id && s.month === month);

  function save() {
    if (existing) return;
    const seq = String(salarySlips.filter(s => s.date === todayStr).length + 1).padStart(2, '0');
    const slip: SalarySlip = {
      id: genId('sal'), slipNumber: `GG-SAL-${todayStr.replace(/-/g, '').slice(2)}-${seq}`,
      staffId: t.id, staffName: t.name, role: t.role, employeeId: t.employeeId, department: t.department,
      month, date: todayStr, baseSalary: base, allowance, commission, bonus, appreciation, fines, netPay: net,
      status: 'Generated', paidDate: '',
    };
    setSalarySlips(prev => [...prev, slip]);
    logActivity(`Salary slip generated — ${t.name}, ${monthLabel(month)}, ${money(net)}`);
    toast('Salary slip generated');
    onCreated(slip.id);
  }

  const num = (v: number, set: (n: number) => void) => <input type="number" value={v} onChange={e => set(Number(e.target.value))} style={{ fontSize: 15 }} />;
  return (
    <>
      <ModalTitle>New salary slip — {t.name}</ModalTitle>
      <Field label="Salary month">
        <select value={month} onChange={e => changeMonth(e.target.value)} style={{ fontSize: 15 }}>
          {monthOptions.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </Field>
      <div className="text-[13.5px] text-[var(--muted)] mb-3">Amounts are filled in from this employee’s record — change anything that needs adjusting before you generate.</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Base salary (PKR)">{num(base, setBase)}</Field>
        <Field label="Monthly allowance (PKR)">{num(allowance, setAllowance)}</Field>
        <Field label="Commission (PKR)">{num(commission, setCommission)}</Field>
        <Field label="Closed-case bonus (PKR)">{num(bonus, setBonus)}</Field>
        <Field label="Appreciation (PKR)">{num(appreciation, setAppreciation)}</Field>
        <Field label="Fines (PKR)">{num(fines, setFines)}</Field>
      </div>
      {quotaNote >= 0 && (
        <div className="text-[13.5px] mb-3" style={{ color: '#8a5a12' }}>
          Commission is set to 0 because {t.name.split(' ')[0]} closed {quotaNote} of {quota} cases in {monthLabel(month)}. Enter an amount if you want to pay it anyway.
        </div>
      )}
      {existing && <div className="text-[13.5px] mb-3" style={{ color: '#B5433A' }}>A salary slip for {monthLabel(month)} already exists ({existing.slipNumber}). Open it from the list instead.</div>}
      <div className="card mb-4" style={{ background: 'var(--gold-50)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', color: 'var(--muted)' }}>NET PAY</div>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 30, fontWeight: 700, color: '#14213D' }}>{money(net)}</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>{rupeesInWords(net)}</div>
      </div>
      <ModalFoot>
        <button className="btn" onClick={onCancel}>Back</button>
        <button className="btn btn-primary" onClick={save} disabled={!!existing}>Generate slip</button>
      </ModalFoot>
    </>
  );
}

function SalarySlipView({ slipId, onBack }: { slipId: string; onBack: () => void }) {
  const { salarySlips, setSalarySlips, setTransactions, setTeam, logActivity } = useAppData();
  const toast = useToast();
  const s = salarySlips.find(x => x.id === slipId)!;

  function markPaid() {
    if (s.status === 'Paid') return;
    const note = `Salary slip ${s.slipNumber} — ${monthLabel(s.month)}`;
    const parts: [string, number][] = [
      ['Salary', Math.max(0, s.baseSalary + s.allowance - s.fines)],
      ['Commission', s.commission], ['Bonus', s.bonus], ['Appreciation', s.appreciation],
    ];
    setTransactions(prev => [...prev, ...parts.filter(([, amt]) => amt > 0).map(([category, amount]) => ({
      id: genId('tx'), date: today(), type: 'Expense' as const, category, party: s.staffName, amount, note,
    }))]);
    setSalarySlips(prev => prev.map(x => x.id === s.id ? { ...x, status: 'Paid' as const, paidDate: today() } : x));
    setTeam(prev => prev.map(x => x.id === s.staffId ? { ...x, lastSalaryPaid: today() } : x));
    logActivity(`Salary paid — ${s.staffName}, ${monthLabel(s.month)}, ${money(s.netPay)}`);
    toast('Salary recorded as paid');
  }

  const F = 'Arial, Helvetica, sans-serif';
  const cell: CSSProperties = { border: '1px solid #cfd8dc', padding: '8px 14px', fontSize: 15, fontFamily: F };
  const head: CSSProperties = { ...cell, background: '#14213D', color: '#fff', fontWeight: 700, fontSize: 14 };
  const earn: [string, number][] = [['Base salary', s.baseSalary], ['Monthly allowance', s.allowance], ['Commission', s.commission], ['Closed-case bonus', s.bonus], ['Appreciation', s.appreciation]];
  const gross = s.baseSalary + s.allowance + s.commission + s.bonus + s.appreciation;

  return (
    <>
      <div className="no-print flex items-center justify-between mb-3.5">
        <button className="btn btn-sm" onClick={onBack}>← All slips</button>
        <div className="flex items-center gap-2">
          {s.status === 'Generated'
            ? <button className="btn btn-sm" onClick={markPaid}>Mark as paid</button>
            : <span style={{ color: 'var(--green)', fontSize: 14, fontWeight: 600 }}>✓ Paid {fmtDate(s.paidDate)}</span>}
          <button className="btn btn-sm btn-primary" onClick={printSheet}>Print / Save as PDF</button>
        </div>
      </div>

      <div id="invoice-print-area" style={{ background: '#fff', color: '#1a1a1a', fontFamily: F, padding: 4 }}>
        <div className="avoid-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <img src={LOGO_FULL} style={{ height: 60 }} alt="GoGlobe Consultant" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#14213D', letterSpacing: '.02em' }}>SALARY SLIP</div>
            <div style={{ fontSize: 15 }}><b>Pay period:</b> {monthLabel(s.month)}</div>
            <div style={{ fontSize: 15 }}><b>Slip No:</b> {s.slipNumber}</div>
          </div>
        </div>
        <div style={{ height: 5, background: 'linear-gradient(90deg,#1FA463,#1F6E8C,#14213D)', marginBottom: 16 }} />

        <div className="avoid-break" style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <div style={{ flex: 1, background: '#F2F8F5', padding: 12, fontSize: 15, lineHeight: 1.65 }}>
            <div style={{ fontWeight: 700, color: '#14213D', marginBottom: 4 }}>EMPLOYEE</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{s.staffName}</div>
            <div>{s.role}</div>
            <div>ID: {s.employeeId} &nbsp;·&nbsp; {s.department}</div>
          </div>
          <div style={{ flex: 1, background: '#F2F8F5', padding: 14, fontSize: 15, lineHeight: 1.65 }}>
            <div style={{ fontWeight: 700, color: '#14213D', marginBottom: 4 }}>PAYMENT</div>
            <div>Prepared on {fmtDate(s.date)}</div>
            <div>Status: <b style={{ color: s.status === 'Paid' ? '#0B6E4F' : '#B5433A' }}>{s.status === 'Paid' ? 'PAID' : 'NOT PAID YET'}</b></div>
            <div>{s.status === 'Paid' ? `Paid on ${fmtDate(s.paidDate)}` : 'Payment date to be recorded'}</div>
          </div>
        </div>

        <div className="avoid-break">
          <div style={{ fontWeight: 700, fontSize: 16, color: '#14213D', marginBottom: 6 }}>EARNINGS</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead><tr><th style={{ ...head, textAlign: 'left' }}>Description</th><th style={{ ...head, textAlign: 'right', width: 190 }}>Amount (PKR)</th></tr></thead>
            <tbody>
              {earn.filter(([, a], i) => a > 0 || i === 0).map(([label, a]) => (
                <tr key={label}><td style={cell}>{label}</td><td style={{ ...cell, textAlign: 'right' }}>{a.toLocaleString()}</td></tr>
              ))}
              <tr><td style={{ ...cell, fontWeight: 700, background: '#F7F9FA' }}>Gross earnings</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700, background: '#F7F9FA' }}>{gross.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>

        {s.fines > 0 && (
          <div className="avoid-break">
            <div style={{ fontWeight: 700, fontSize: 16, color: '#14213D', marginBottom: 6 }}>DEDUCTIONS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead><tr><th style={{ ...head, textAlign: 'left' }}>Description</th><th style={{ ...head, textAlign: 'right', width: 190 }}>Amount (PKR)</th></tr></thead>
              <tbody><tr><td style={cell}>Fines</td><td style={{ ...cell, textAlign: 'right', color: '#B5433A' }}>− {s.fines.toLocaleString()}</td></tr></tbody>
            </table>
          </div>
        )}

        <div className="avoid-break" style={{ background: '#FBF0DD', border: '1px solid #E8C784', padding: '14px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#14213D' }}>NET PAY</div>
            <div style={{ fontWeight: 700, fontSize: 30, color: '#0B6E4F' }}>PKR {s.netPay.toLocaleString()}</div>
          </div>
          <div style={{ fontSize: 14.5, marginTop: 6, color: '#444' }}>{rupeesInWords(s.netPay)}</div>
        </div>

        <div className="avoid-break" style={{ display: 'flex', gap: 48, margin: '24px 0 10px' }}>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>EMPLOYEE SIGNATURE</div>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>AUTHORIZED SIGNATURE / COMPANY STAMP</div>
        </div>
        <div style={{ fontSize: 12.5, color: '#666', marginBottom: 12 }}>This is a computer-generated salary slip issued by GoGlobe Consultant.</div>

        <div className="avoid-break" style={{ background: '#14213D', color: '#fff', padding: '12px 16px', fontSize: 13, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div><b>WhatsApp</b><br />0317-9911228 | 0327-9911228</div>
          <div><b>PTCL</b><br />051-6126833</div>
          <div><b>Email</b><br />info@goglobeconsultants.com</div>
          <div><b>Website</b><br />goglobeconsultants.com</div>
        </div>
      </div>
    </>
  );
}
