'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today, DEPARTMENTS, JOB_DESCRIPTIONS } from '@/lib/constants';
import { overallPaid } from './Cases';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { TeamMember } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export function HR() {
  const { team, requests, setRequests, cases, leads, transactions, logActivity } = useAppData();
  const [formStaff, setFormStaff] = useState<TeamMember | 'new' | null>(null);
  const [pinReveal, setPinReveal] = useState<{ name: string; pin: string } | null>(null);
  const [adjustFor, setAdjustFor] = useState<{ staff: TeamMember; type: 'Bonus' | 'Fine' } | null>(null);
  const toast = useToast();

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
          <thead><tr><th>Name</th><th>Post / designation</th><th>Department</th><th>Contract</th><th>Contact</th><th>PIN</th><th></th></tr></thead>
          <tbody>
            {team.map(t => (
              <tr key={t.id}>
                <td className="font-medium">{t.name}<div className="font-mono-ui text-xs">{t.employeeId}</div></td>
                <td>{t.role}</td>
                <td><Stamp text={t.department} /></td>
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
                        <button className="btn btn-sm" onClick={() => { setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'Approved' } : x)); logActivity(`Approved request from ${emp?.name} (${r.type})`); }}>Approve</button>
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
  const bonusEarned = won * t.bonusPerClose;
  const bonusPaid = transactions.filter(x => x.category === 'Bonus' && x.party === t.name).reduce((s, x) => s + x.amount, 0);
  const bonusDue = Math.max(0, bonusEarned - bonusPaid);
  const myAdj = adjustments.filter(a => a.staffId === t.id);
  const apprTotal = myAdj.filter(a => a.type === 'Bonus').reduce((s, a) => s + a.amount, 0);
  const fineTotal = myAdj.filter(a => a.type === 'Fine').reduce((s, a) => s + a.amount, 0);

  function paySalary() {
    setTransactions(prev => [...prev, { id: genId('tx'), date: today(), type: 'Expense', category: 'Salary', party: t.name, amount: t.salary, note: 'Monthly salary' }]);
    setTeam(prev => prev.map(x => x.id === t.id ? { ...x, lastSalaryPaid: today() } : x));
    logActivity(`Salary paid — ${t.name}, ${money(t.salary)}`);
    toast('Salary recorded');
  }
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
        {isSales && <>
          <Row label="Commission due" value={money(commissionDue)} />
          <Row label="Bonus due" value={money(bonusDue)} />
        </>}
        {(apprTotal || fineTotal) ? <Row label="Appreciation / fines" value={`+${money(apprTotal)} / -${money(fineTotal)}`} last /> : null}
        <div className="flex gap-2 flex-wrap mt-2.5">
          <button className="btn btn-sm flex-1" onClick={paySalary}>Pay salary</button>
          {isSales && commissionDue > 0 && <button className="btn btn-sm flex-1" onClick={payCommission}>Pay commission</button>}
          {isSales && bonusDue > 0 && <button className="btn btn-sm flex-1" onClick={payBonus}>Pay bonus</button>}
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-sm flex-1" style={{ color: 'var(--green)' }} onClick={() => onAdjust('Bonus')}>+ Appreciation</button>
          <button className="btn btn-sm flex-1" style={{ color: 'var(--red)' }} onClick={() => onAdjust('Fine')}>+ Fine</button>
        </div>
      </div>
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

  function save() {
    if (!name.trim()) { toast('Enter a name'); return; }
    const data: TeamMember = {
      id: t?.id || `tm_${Date.now().toString(36)}`, name, phone, email, department, role: role || 'Staff',
      education, experience, contractType, contractStart, contractEnd, shiftStart, shiftEnd,
      salary, commissionPercent, bonusPerClose, jobDescription, employeeId, pin, lastSalaryPaid: t?.lastSalaryPaid || '',
    };
    if (t) setTeam(prev => prev.map(x => x.id === t.id ? data : x));
    else setTeam(prev => [...prev, data]);
    toast(t ? 'Profile saved' : 'Employee added');
    onClose();
  }

  return (
    <>
      <ModalTitle>{t ? `Employee profile — ${t.name}` : 'Add new employee'}</ModalTitle>
      <SectionHead title="Personal & contact details" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} /></Field>

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
      <Field label="Monthly base salary (PKR)"><input type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} /></Field>
      {department === 'Sales' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Commission (%)"><input type="number" value={commissionPercent} onChange={e => setCommissionPercent(Number(e.target.value))} /></Field>
          <Field label="Bonus per closed case (PKR)"><input type="number" value={bonusPerClose} onChange={e => setBonusPerClose(Number(e.target.value))} /></Field>
        </div>
      )}
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
