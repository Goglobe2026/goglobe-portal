'use client';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, genId, today } from '@/lib/constants';
import { SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

function nowTime() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

export function Attendance() {
  const { team, attendance, setAttendance } = useAppData();
  const toast = useToast();

  function todaysRecord(staffId: string) { return attendance.find(a => a.staffId === staffId && a.date === today()); }

  function checkIn(staffId: string) {
    const existing = todaysRecord(staffId);
    if (existing) setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, checkIn: nowTime() } : a));
    else setAttendance(prev => [...prev, { id: genId('at'), staffId, date: today(), checkIn: nowTime(), checkOut: '' }]);
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
            {team.map(t => {
              const rec = todaysRecord(t.id);
              let status = 'Not checked in';
              if (rec?.checkIn) { status = (t.shiftStart && rec.checkIn > t.shiftStart) ? 'Missed' : 'Completed'; }
              return (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}<div className="text-[var(--muted)] text-[11px]">{t.role}</div></td>
                  <td className="font-mono-ui text-xs">{t.employeeId}</td>
                  <td className="font-mono-ui text-xs">{t.shiftStart}–{t.shiftEnd}</td>
                  <td className="font-mono-ui text-xs">{rec?.checkIn || '—'}</td>
                  <td className="font-mono-ui text-xs">{rec?.checkOut || '—'}</td>
                  <td><Stamp text={status === 'Completed' ? (rec?.checkOut ? 'Completed' : 'Scheduled') : status} /></td>
                  <td>
                    <div className="flex gap-1.5 justify-end">
                      {!rec?.checkIn && <button className="btn btn-sm" onClick={() => checkIn(t.id)}>Check in</button>}
                      {rec?.checkIn && !rec?.checkOut && <button className="btn btn-sm" onClick={() => checkOut(t.id)}>Check out</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionHead title="Recent history" count="last 20 entries" />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Date</th><th>Staff</th><th>Check-in</th><th>Check-out</th></tr></thead>
          <tbody>
            {history.length ? history.map(a => {
              const t = team.find(x => x.id === a.staffId);
              return <tr key={a.id}><td className="font-mono-ui text-xs">{fmtDate(a.date)}</td><td className="font-medium">{t?.name || '—'}</td><td className="font-mono-ui text-xs">{a.checkIn || '—'}</td><td className="font-mono-ui text-xs">{a.checkOut || '—'}</td></tr>;
            }) : <tr><td colSpan={4} className="text-[var(--muted)] p-3.5">No attendance recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
