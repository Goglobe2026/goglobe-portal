'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, genId, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { Modal, ModalTitle, ModalFoot } from '@/components/ui/Primitives';
import { daysBetween } from '@/lib/finance';
import { ARIAL, NAVY, th, td, R, inputStyle, lbl, bigBtn } from '@/components/ui/docStyles';
import type { Complaint } from '@/lib/types';

const CATEGORIES = ['Delay in processing', 'Staff behaviour', 'Money demanded', 'Document error', 'Refund request', 'Appointment problem', 'Other'];
const SLA_DAYS: Record<Complaint['severity'], number> = { High: 2, Medium: 3, Low: 5 };
const dueOf = (c: Complaint) => { const d = new Date(c.date + 'T00:00:00'); d.setDate(d.getDate() + SLA_DAYS[c.severity]); return d.toLocaleDateString('en-CA'); };
const SEV_COLOR = { High: '#B5433A', Medium: '#8a5a12', Low: '#5B6270' };

export function Complaints() {
  const { complaints } = useAppData();
  const [tab, setTab] = useState<'complaints' | 'feedback'>('complaints');
  const [prefill, setPrefill] = useState<Partial<Complaint> | null>(null);
  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="flex gap-2 mb-5" style={{ borderBottom: '1px solid #DCE5E0', paddingBottom: 12 }}>
        {([['complaints', `Complaints (${complaints.filter(c => c.status !== 'Resolved').length} open)`], ['feedback', 'Client feedback']] as const).map(([k, l]) => (
          <button key={k} className="btn" onClick={() => setTab(k)} style={{ fontSize: 15, padding: '9px 18px', fontWeight: 700, background: tab === k ? NAVY : '#fff', color: tab === k ? '#fff' : NAVY, borderColor: tab === k ? NAVY : '#DCE5E0' }}>{l}</button>))}
      </div>
      {tab === 'complaints' ? <ComplaintList prefill={prefill} clearPrefill={() => setPrefill(null)} /> : <FeedbackTab onRaise={f => { setPrefill(f); setTab('complaints'); }} />}
    </div>
  );
}

function ComplaintList({ prefill, clearPrefill }: { prefill: Partial<Complaint> | null; clearPrefill: () => void }) {
  const { complaints, setComplaints, team, logActivity } = useAppData();
  const toast = useToast();
  const todayStr = today();
  const [filter, setFilter] = useState<'Active' | Complaint['status'] | 'All'>('Active');
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const isOver = (c: Complaint) => c.status !== 'Resolved' && todayStr > dueOf(c);
  const month = todayStr.slice(0, 7);
  const resolvedThisMonth = complaints.filter(c => c.status === 'Resolved' && c.resolvedDate.slice(0, 7) === month);
  const avg = complaints.filter(c => c.status === 'Resolved' && c.resolvedDate).map(c => daysBetween(c.date, c.resolvedDate));
  const stats = [
    ['Open complaints', String(complaints.filter(c => c.status !== 'Resolved').length), NAVY],
    ['Overdue', String(complaints.filter(isOver).length), '#B5433A'],
    ['Escalated', String(complaints.filter(c => c.status === 'Escalated').length), '#8a5a12'],
    ['Resolved this month', String(resolvedThisMonth.length), '#0B6E4F'],
    ['Average days to resolve', avg.length ? (avg.reduce((s, x) => s + x, 0) / avg.length).toFixed(1) : '—', NAVY],
  ];
  const rows = complaints.filter(c => filter === 'All' ? true : filter === 'Active' ? c.status !== 'Resolved' : c.status === filter)
    .sort((a, b) => Number(isOver(b)) - Number(isOver(a)) || (a.severity === 'High' ? 0 : 1) - (b.severity === 'High' ? 0 : 1) || b.date.localeCompare(a.date));
  const quick = (id: string, status: Complaint['status']) => {
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c)); logActivity(`Complaint marked ${status}`); toast(`Marked ${status}`);
  };
  const showForm = creating || !!prefill;
  return (
    <>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {stats.map(([a, b, col]) => <div key={a} className="card"><div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>{a}</div><div style={{ fontSize: 26, fontWeight: 700, color: col }}>{b}</div></div>)}
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex gap-2 flex-wrap">{(['Active', 'Open', 'In progress', 'Escalated', 'Resolved', 'All'] as const).map(k => (
          <button key={k} className="btn" onClick={() => setFilter(k)} style={{ fontSize: 14.5, padding: '8px 14px', fontWeight: 700, background: filter === k ? NAVY : '#fff', color: filter === k ? '#fff' : NAVY, borderColor: filter === k ? NAVY : '#DCE5E0' }}>{k}</button>))}</div>
        <button className="btn btn-primary" style={bigBtn} onClick={() => setCreating(true)}>+ Log a complaint</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {rows.length === 0 ? <div style={{ padding: 22, fontSize: 15.5, color: '#5B6270' }}>No complaints here.</div> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Client</th><th style={th}>Issue</th><th style={th}>Handled by</th><th style={th}>Status</th><th style={th}></th></tr></thead>
            <tbody>{rows.map(c => (
              <tr key={c.id}>
                <td style={td}><b>{c.clientName}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{fmtDate(c.date)} · {c.phone}</div></td>
                <td style={td}><span style={{ fontWeight: 700, color: SEV_COLOR[c.severity] }}>{c.severity}</span> · {c.category}<div style={{ fontSize: 13.5, color: '#444', maxWidth: 380 }}>{c.description}</div></td>
                <td style={td}>{team.find(t => t.id === c.assignedTo)?.name || <span style={{ color: '#93AC9F' }}>Unassigned</span>}</td>
                <td style={td}><b style={{ color: c.status === 'Resolved' ? '#0B6E4F' : c.status === 'Escalated' ? '#B5433A' : NAVY }}>{c.status}</b>
                  {c.status !== 'Resolved' && <div style={{ fontSize: 12.5, color: isOver(c) ? '#B5433A' : '#5B6270', fontWeight: isOver(c) ? 700 : 400 }}>{isOver(c) ? 'OVERDUE — was due ' : 'Due '}{fmtDate(dueOf(c))}</div>}
                  {c.status === 'Resolved' && <div style={{ fontSize: 12.5, color: '#5B6270' }}>{fmtDate(c.resolvedDate)}</div>}</td>
                <td style={{ ...td, ...R }}><div className="flex gap-1.5 justify-end flex-wrap">
                  {c.status === 'Open' && <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => quick(c.id, 'In progress')}>Start</button>}
                  {c.status !== 'Resolved' && c.status !== 'Escalated' && <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => quick(c.id, 'Escalated')}>Escalate</button>}
                  <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => setEditId(c.id)}>{c.status === 'Resolved' ? 'View' : 'Resolve / edit'}</button></div></td>
              </tr>))}</tbody>
          </table>}
      </div>
      <div style={{ fontSize: 13.5, color: '#5B6270', marginTop: 8 }}>Response targets: High severity 2 days, Medium 3 days, Low 5 days. Anything past its date shows as overdue and floats to the top.</div>
      <Modal open={showForm} onClose={() => { setCreating(false); clearPrefill(); }} wide>{showForm && <ComplaintForm initial={prefill} onClose={() => { setCreating(false); clearPrefill(); }} />}</Modal>
      <Modal open={!!editId} onClose={() => setEditId(null)} wide>{editId && <ComplaintEditor id={editId} onClose={() => setEditId(null)} />}</Modal>
    </>
  );
}

function ComplaintForm({ initial, onClose }: { initial: Partial<Complaint> | null; onClose: () => void }) {
  const { cases, team, setComplaints, logActivity } = useAppData();
  const toast = useToast();
  const [caseId, setCaseId] = useState(initial?.caseId || '');
  const [clientName, setClientName] = useState(initial?.clientName || ''); const [phone, setPhone] = useState(initial?.phone || '');
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]); const [severity, setSeverity] = useState<Complaint['severity']>(initial?.severity || 'Medium');
  const [description, setDescription] = useState(initial?.description || ''); const [assignedTo, setAssignedTo] = useState(initial?.assignedTo || '');
  const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
  function pickCase(id: string) { setCaseId(id); const c = cases.find(x => x.id === id); if (c) { setClientName(c.name); setPhone(c.phone); if (!assignedTo) setAssignedTo(c.consultant); } }
  function save() {
    if (!clientName.trim() || !description.trim()) { toast('Enter the client name and what the complaint is'); return; }
    setComplaints(prev => [...prev, { id: genId('cmp'), date: today(), clientName: clientName.trim(), phone, caseId, category, severity, description: description.trim(), assignedTo, status: 'Open', resolution: '', resolvedDate: '' }]);
    logActivity(`Complaint logged — ${clientName}, ${category}`); toast('Complaint logged'); onClose();
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>Log a client complaint</ModalTitle>
      <label style={lbl}>Client’s case (optional — fills in the details)</label>
      <select value={caseId} onChange={e => pickCase(e.target.value)} style={inputStyle}><option value="">Not linked to a case</option>{cases.map(c => <option key={c.id} value={c.id}>{c.name} — {c.destination}</option>)}</select>
      <div className="grid grid-cols-2 gap-3">
        <div><label style={lbl}>Client name</label><input value={clientName} onChange={e => setClientName(e.target.value)} style={inputStyle} /></div>
        <div><label style={lbl}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
        <div><label style={lbl}>What is it about?</label><select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label style={lbl}>How serious?</label><select value={severity} onChange={e => setSeverity(e.target.value as Complaint['severity'])} style={inputStyle}><option>High</option><option>Medium</option><option>Low</option></select></div>
      </div>
      <label style={lbl}>What happened?</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
      <label style={lbl}>Who will handle it?</label>
      <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={inputStyle}><option value="">Not assigned yet</option>{staff.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}</select>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Log complaint</button></ModalFoot>
    </div>
  );
}

function ComplaintEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { complaints, setComplaints, team, logActivity } = useAppData();
  const toast = useToast();
  const c = complaints.find(x => x.id === id)!;
  const [status, setStatus] = useState(c.status); const [assignedTo, setAssignedTo] = useState(c.assignedTo); const [resolution, setResolution] = useState(c.resolution);
  const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
  function save() {
    if (status === 'Resolved' && !resolution.trim()) { toast('Write how it was resolved before closing it'); return; }
    setComplaints(prev => prev.map(x => x.id === id ? { ...x, status, assignedTo, resolution, resolvedDate: status === 'Resolved' ? (x.resolvedDate || today()) : '' } : x));
    logActivity(`Complaint ${status.toLowerCase()} — ${c.clientName}`); toast('Saved'); onClose();
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>{c.clientName} — {c.category}</ModalTitle>
      <div style={{ fontSize: 15, lineHeight: 1.6, background: '#F7F9FA', padding: 12, borderRadius: 8, marginBottom: 8 }}><b>{c.severity}</b> · logged {fmtDate(c.date)}<br />{c.description}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><label style={lbl}>Status</label><select value={status} onChange={e => setStatus(e.target.value as Complaint['status'])} style={inputStyle}><option>Open</option><option>In progress</option><option>Escalated</option><option>Resolved</option></select></div>
        <div><label style={lbl}>Handled by</label><select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={inputStyle}><option value="">Not assigned</option>{staff.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      </div>
      <label style={lbl}>How it was resolved</label><textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)} style={inputStyle} placeholder="What was done, and what the client was told" />
      <ModalFoot><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={save}>Save</button></ModalFoot>
    </div>
  );
}

function FeedbackTab({ onRaise }: { onRaise: (f: Partial<Complaint>) => void }) {
  const { clientFeedback, team } = useAppData();
  const list = clientFeedback.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const avg = list.length ? list.reduce((s, f) => s + f.rating, 0) / list.length : 0;
  const rec = list.length ? Math.round(list.filter(f => f.wouldRecommend).length / list.length * 100) : 0;
  const money = list.filter(f => f.moneyDemanded).length;
  return (
    <>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[['Feedback received', String(list.length), NAVY], ['Average rating', list.length ? `${avg.toFixed(1)} / 5` : '—', NAVY], ['Would recommend', list.length ? `${rec}%` : '—', '#0B6E4F'], ['Reported money demanded', String(money), money ? '#B5433A' : '#0B6E4F']].map(([a, b, col]) => (
          <div key={a} className="card"><div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>{a}</div><div style={{ fontSize: 26, fontWeight: 700, color: col }}>{b}</div></div>))}
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {list.length === 0 ? <div style={{ padding: 22, fontSize: 15.5, color: '#5B6270' }}>No client feedback yet. Clients can leave it from their case-status page.</div> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Client</th><th style={th}>Consultant</th><th style={th}>Rating</th><th style={th}>Comment</th><th style={th}></th></tr></thead>
            <tbody>{list.map(f => (
              <tr key={f.id}><td style={td}><b>{f.clientName}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{f.caseReferenceCode} · {fmtDate(f.submittedAt.slice(0, 10))}</div></td>
                <td style={td}>{team.find(t => t.id === f.consultantId)?.name || '—'}</td>
                <td style={{ ...td, color: f.rating <= 2 ? '#B5433A' : '#8a5a12', fontSize: 17 }}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
                <td style={{ ...td, fontSize: 14 }}>{f.comment || '—'}{f.moneyDemanded && <div style={{ color: '#B5433A', fontWeight: 700 }}>Money demanded: {f.moneyDemandedDetails || 'no details'}</div>}</td>
                <td style={{ ...td, ...R }}>{(f.rating <= 2 || f.moneyDemanded) && <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => onRaise({ clientName: f.clientName, assignedTo: f.consultantId, category: f.moneyDemanded ? 'Money demanded' : 'Other', severity: f.moneyDemanded ? 'High' : 'Medium', description: f.moneyDemanded ? f.moneyDemandedDetails : f.comment })}>Raise complaint</button>}</td></tr>))}</tbody>
          </table>}
      </div>
    </>
  );
}
