'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { Appointment } from '@/lib/types';

function waLink(phone: string, text: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function addDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

const STATUSES = ['Watching for slot', 'Scheduled', 'Completed', 'Missed'] as const;
const STATUS_COLOR: Record<string, string> = {
  'Watching for slot': 'var(--gold)', Scheduled: 'var(--blue)', Completed: 'var(--green)', Missed: 'var(--red)',
};

export function Appointments() {
  const { appointments, setAppointments, team } = useAppData();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [showBook, setShowBook] = useState(false);
  const [prefillDate, setPrefillDate] = useState('');
  const consultantName = (id: string) => team.find(t => t.id === id)?.name || 'Unassigned';

  const t0 = today(), t1 = addDays(1), weekEnd = addDays(7);
  const groups: Record<string, Appointment[]> = { Today: [], Tomorrow: [], 'This week': [], Later: [], Past: [] };
  [...appointments].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).forEach(a => {
    if (a.date < t0) groups.Past.push(a);
    else if (a.date === t0) groups.Today.push(a);
    else if (a.date === t1) groups.Tomorrow.push(a);
    else if (a.date <= weekEnd) groups['This week'].push(a);
    else groups.Later.push(a);
  });

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay: Record<string, Appointment[]> = {};
  appointments.forEach(a => { if (a.date.slice(0, 7) === month) { (byDay[a.date] ||= []).push(a); } });

  function remove(id: string) { setAppointments(prev => prev.filter(a => a.id !== id)); }
  function setStatus(id: string, status: Appointment['status']) { setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a)); }

  return (
    <div>
      <SectionHead title="Booking calendar" count="click a day to book" action={
        <button className="btn btn-primary ml-auto" onClick={() => { setPrefillDate(today()); setShowBook(true); }}>+ Book appointment</button>
      } />

      <div className="card">
        <div className="flex items-center justify-between mb-3.5">
          <button className="btn btn-sm" onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toISOString().slice(0, 7)); }}>‹ Prev</button>
          <div className="font-display font-semibold text-[15px]">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
          <button className="btn btn-sm" onClick={() => { const d = new Date(y, m, 1); setMonth(d.toISOString().slice(0, 7)); }}>Next ›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="font-mono-ui text-[10.5px] text-[var(--faint)] text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startPad }).map((_, i) => <div key={'pad' + i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayAppts = byDay[dateStr] || [];
            const isToday = dateStr === today();
            return (
              <div key={d} onClick={() => { setPrefillDate(dateStr); setShowBook(true); }}
                className="cursor-pointer rounded-[10px] p-1.5 min-h-16 transition-shadow hover:shadow-sm"
                style={{ border: `1px solid ${isToday ? 'var(--navy-light)' : 'var(--line)'}`, background: isToday ? 'var(--navy-50)' : '#fff' }}>
                <div className="font-mono-ui text-[11px]" style={{ color: isToday ? 'var(--navy)' : 'var(--muted)', fontWeight: isToday ? 700 : 500 }}>{d}</div>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayAppts.slice(0, 4).map(a => (
                    <span key={a.id} title={`${a.clientName} — ${a.type}`} className="w-[7px] h-[7px] rounded-full" style={{ background: STATUS_COLOR[a.status] }} />
                  ))}
                  {dayAppts.length > 4 && <span className="font-mono-ui text-[9.5px] text-[var(--faint)]">+{dayAppts.length - 4}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[11.5px] text-[var(--faint)] mt-2.5">Click any day to book an appointment for that date. Dots show what&apos;s already booked — blue = scheduled, gold = watching for a slot, green = completed, red = missed.</div>
      </div>

      {appointments.length ? (
        <>
          <SectionHead title="All appointments" count={`${appointments.length} total · any time, any day`} />
          {(['Today', 'Tomorrow', 'This week', 'Later', 'Past'] as const).map(label => groups[label].length > 0 && (
            <div key={label}>
              <SectionHead title={label} count={String(groups[label].length)} />
              <div className="card p-0 overflow-auto mb-4">
                <table>
                  <thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Type</th><th>Visa centre / portal</th><th>Consultant</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {groups[label].map(a => (
                      <tr key={a.id}>
                        <td className="font-mono-ui text-xs">{fmtDate(a.date)}</td>
                        <td className="font-mono-ui text-xs">{a.time || 'Any time'}</td>
                        <td className="font-medium">{a.clientName}{a.phone && <div className="font-mono-ui text-xs">{a.phone}</div>}</td>
                        <td>{a.type}</td>
                        <td>{a.portal && a.portal !== '—' ? a.portal : <span className="text-[var(--muted)]">—</span>}</td>
                        <td>{consultantName(a.consultant)}</td>
                        <td>
                          <select className="border-none bg-transparent font-medium p-0.5" value={a.status} onChange={e => setStatus(a.id, e.target.value as Appointment['status'])}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td>
                          <div className="flex gap-1.5 justify-end">
                            {a.phone && <a className="btn btn-sm" style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff' }} target="_blank"
                              href={waLink(a.phone, `Hello ${a.clientName}, this is GoGlobe Consultant regarding your ${a.type.toLowerCase()} on ${fmtDate(a.date)}.`)}>WhatsApp</a>}
                            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(a.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : <EmptyState title="No appointments booked yet" body='Click a day on the calendar above, or use "+ Book appointment".' />}

      <div className="card mt-4" style={{ background: 'var(--gold-50)' }}>
        <div className="text-[12.5px]" style={{ color: '#6b4e10' }}>&quot;Watching for slot&quot; entries are checked manually on the visa centre&apos;s own site. Automated slot-booking bots aren&apos;t supported here — those portals ban automated access.</div>
      </div>

      <Modal open={showBook} onClose={() => setShowBook(false)}>
        <BookForm prefillDate={prefillDate} onClose={() => setShowBook(false)} />
      </Modal>
    </div>
  );
}

function BookForm({ prefillDate, onClose }: { prefillDate: string; onClose: () => void }) {
  const { setAppointments, team } = useAppData();
  const toast = useToast();
  const [clientName, setClientName] = useState(''); const [phone, setPhone] = useState('');
  const [date, setDate] = useState(prefillDate); const [time, setTime] = useState('10:00'); const [anytime, setAnytime] = useState(false);
  const [type, setType] = useState('Free consultation'); const [portal, setPortal] = useState('');
  const assignable = team.filter(t => ['Sales', 'Management'].includes(t.department));
  const [consultant, setConsultant] = useState(assignable[0]?.id || '');

  function save() {
    if (!clientName.trim()) { toast('Enter a client name'); return; }
    if (phone) {
      const msg = `Hello ${clientName}, this is GoGlobe Consultant. Your ${type.toLowerCase()} has been booked for ${fmtDate(date)}${!anytime ? ' at ' + time : ''}${portal ? ' — ' + portal : ''}. We look forward to assisting you.`;
      window.open(waLink(phone, msg), '_blank');
    }
    setAppointments(prev => [...prev, {
      id: genId('ap'), clientName, phone, date, time: anytime ? '' : time, type, portal, consultant, status: 'Scheduled',
    }]);
    toast(phone ? 'Booked — WhatsApp message opened, tap Send to deliver' : 'Appointment booked (add a phone number to auto-message the client)');
    onClose();
  }

  return (
    <>
      <ModalTitle>Book appointment</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Client name"><input value={clientName} onChange={e => setClientName(e.target.value)} /></Field>
        <Field label="Phone / WhatsApp"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03XX XXXXXXX" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Time"><input type="time" value={time} disabled={anytime} onChange={e => setTime(e.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-[var(--muted)] -mt-1 mb-3">
        <input type="checkbox" className="!w-auto" checked={anytime} onChange={e => setAnytime(e.target.checked)} /> No fixed time — any time works
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select value={type} onChange={e => setType(e.target.value)}>
            {['Free consultation', 'Document collection', 'Visa centre appointment', 'Embassy appointment', 'Interview prep', 'Refusal case review'].map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Visa centre / portal"><input value={portal} onChange={e => setPortal(e.target.value)} placeholder="e.g. BLS Spain, VFS Global" /></Field>
      </div>
      <Field label="Consultant"><select value={consultant} onChange={e => setConsultant(e.target.value)}>{assignable.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}</select></Field>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-1">If a phone number is entered, a WhatsApp confirmation opens automatically once booked — you just tap Send.</div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Book</button>
      </ModalFoot>
    </>
  );
}
