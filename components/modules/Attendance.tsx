'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { TeamMember } from '@/lib/types';

function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

export function Attendance() {
  const { team, attendance, setAttendance, setAdjustments, setTransactions, logActivity } = useAppData();
  const toast = useToast();
  const [fineFor, setFineFor] = useState<{ staff: TeamMember; reason: string } | null>(null);

  function todaysRecord(staffId: string) { return attendance.find(a => a.staffId === staffId && a.date === today()); }

  function checkIn(staffId: string) {
    const existing = todaysRecord(staffId);
    if (existing) setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, checkIn: nowTime() } : a));
    else setAttendance(prev => [...prev, { id: genId('at'), staffId, date: today(), checkIn: nowTime(), checkOut: '', onApprovedLeave: false }]);
    toast('Checked in');
  }
  function checkOut(staffId: string) {
    const existing = todaysRecord(staffId);
    if (existing) setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, checkOut: nowTime() } : a));
    toast('Checked out');
  }

  const history = [...attendance].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  return (
    <div>
      <SectionHead title="Today" count={fmtDate(today())} />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Staff</th><th>ID</th><th>Duty timing</th><th>Check-in</th><th>Check-out</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave').map(t => {
              const rec = todaysRecord(t.id);
              const onLeave = rec?.onApprovedLeave;
              let status = 'Not checked in';
              let late = false;
              if (onLeave) status = 'On Approved Leave';
              else if (rec?.checkIn) {
                late = !!(t.shiftStart && rec.checkIn > t.shiftStart);
                status = late ? 'Late' : (rec?.checkOut ? 'Completed' : 'Scheduled');
              }
              return (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}<div className="text-[var(--muted)] text-[11px]">{t.role}</div></td>
                  <td className="font-mono-ui text-xs">{t.employeeId}</td>
                  <td className="font-mono-ui text-xs">{t.shiftStart}–{t.shiftEnd}</td>
                  <td className="font-mono-ui text-xs">{onLeave ? '—' : (rec?.checkIn || '—')}</td>
                  <td className="font-mono-ui text-xs">{onLeave ? '—' : (rec?.checkOut || '—')}</td>
                  <td><Stamp text={status} /></td>
                  <td>
                    <div className="flex gap-1.5 justify-end">
                      {!onLeave && !rec?.checkIn && <button className="btn btn-sm" onClick={() => checkIn(t.id)}>Check in</button>}
                      {!onLeave && rec?.checkIn && !rec?.checkOut && <button className="btn btn-sm" onClick={() => checkOut(t.id)}>Check out</button>}
                      {!onLeave && late && <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setFineFor({ staff: t, reason: 'Late arrival' })}>Fine for late</button>}
                      {!onLeave && !rec?.checkIn && <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setFineFor({ staff: t, reason: 'Absent — no check-in' })}>Fine for absent</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] mt-2.5">Days covered by an approved leave request never show as late or absent — approve leave requests in HR Department to keep this accurate.</div>

      <SectionHead title="Recent history" count="last 20 entries" />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Date</th><th>Staff</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead>
          <tbody>
            {history.length ? history.map(a => {
              const t = team.find(x => x.id === a.staffId);
              return (
                <tr key={a.id}>
                  <td className="font-mono-ui text-xs">{fmtDate(a.date)}</td>
                  <td className="font-medium">{t?.name || '—'}</td>
                  <td className="font-mono-ui text-xs">{a.onApprovedLeave ? '—' : (a.checkIn || '—')}</td>
                  <td className="font-mono-ui text-xs">{a.onApprovedLeave ? '—' : (a.checkOut || '—')}</td>
                  <td>{a.onApprovedLeave && <Stamp text="On Approved Leave" />}</td>
                </tr>
              );
            }) : <tr><td colSpan={5} className="text-[var(--muted)] p-3.5">No attendance recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!fineFor} onClose={() => setFineFor(null)}>
        {fineFor && <QuickFineForm staff={fineFor.staff} defaultReason={fineFor.reason} onClose={() => setFineFor(null)} />}
      </Modal>
    </div>
  );
}

function QuickFineForm({ staff, defaultReason, onClose }: { staff: TeamMember; defaultReason: string; onClose: () => void }) {
  const { setAdjustments, setTransactions, logActivity } = useAppData();
  const toast = useToast();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState(defaultReason);

  function save() {
    if (amount <= 0) { toast('Enter an amount'); return; }
    setAdjustments(prev => [...prev, { id: genId('adj'), staffId: staff.id, type: 'Fine', amount, reason, date: today() }]);
    setTransactions(prev => [...prev, { id: genId('tx'), date: today(), type: 'Income', category: 'Fine deduction', party: staff.name, amount, note: reason }]);
    logActivity(`Fine — ${staff.name}, ${money(amount)} (${reason})`);
    toast('Fine recorded');
    onClose();
  }

  return (
    <>
      <ModalTitle>Apply fine — {staff.name}</ModalTitle>
      <Field label="Amount (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      <Field label="Reason"><input value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save fine</button>
      </ModalFoot>
    </>
  );
}
