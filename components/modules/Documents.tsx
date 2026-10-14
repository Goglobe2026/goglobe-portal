'use client';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, genId, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { Modal, ModalTitle, ModalFoot } from '@/components/ui/Primitives';
import { LOGO_FULL } from '@/lib/logo';
import { printSheet } from '@/lib/printSheet';
import { rupeesInWords } from '@/lib/moneyWords';
import { daysBetween } from '@/lib/finance';
import { ARIAL, NAVY, th, td, R, inputStyle, lbl, bigBtn } from '@/components/ui/docStyles';
import type { DocRecord, Letter, TeamMember } from '@/lib/types';

const DOC_TYPES = ['Passport', 'CNIC / B-Form', 'Bank statement', 'Educational documents', 'Business / tax documents', 'Employment letter', 'Property documents', 'Photographs', 'Other'];
const seq = (prefix: string, list: { date: string }[]) => `${prefix}-${today().replace(/-/g, '').slice(2)}-${String(list.filter(x => x.date === today()).length + 1).padStart(2, '0')}`;

const Footer = () => (
  <div className="avoid-break" style={{ background: NAVY, color: '#fff', padding: '10px 16px', fontSize: 13, display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 24 }}>
    <div><b>WhatsApp</b><br />0317-9911228 | 0327-9911228</div><div><b>PTCL</b><br />051-6126833</div>
    <div><b>Email</b><br />info@goglobeconsultants.com</div><div><b>Website</b><br />goglobeconsultants.com</div>
  </div>
);
const Letterhead = ({ title, refNo, date }: { title: string; refNo: string; date: string }) => (
  <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <img src={LOGO_FULL} style={{ height: 56 }} alt="GoGlobe Consultant" />
      <div style={{ textAlign: 'right', fontSize: 14.5 }}><div style={{ fontSize: 26, fontWeight: 700, color: NAVY }}>{title}</div><div><b>Ref:</b> {refNo}</div><div><b>Date:</b> {fmtDate(date)}</div></div>
    </div>
    <div style={{ height: 5, background: 'linear-gradient(90deg,#1FA463,#1F6E8C,#14213D)', marginBottom: 14 }} />
  </>
);

// =====================================================================
// CLIENT DOCUMENTS
// =====================================================================
export function ClientDocuments() {
  const { docRegister, setDocRegister, logActivity } = useAppData();
  const toast = useToast();
  const todayStr = today();
  const [filter, setFilter] = useState<'Holding' | DocRecord['status'] | 'All'>('Holding');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const withUs = docRegister.filter(d => d.status === 'With us');
  const stats = [
    ['Originals with us', String(withUs.filter(d => d.isOriginal).length), NAVY],
    ['Submitted to embassy', String(docRegister.filter(d => d.status === 'Submitted to embassy').length), '#1F6E8C'],
    ['Returned this month', String(docRegister.filter(d => d.status === 'Returned to client' && d.statusDate.slice(0, 7) === todayStr.slice(0, 7)).length), '#0B6E4F'],
    ['Held over 60 days', String(withUs.filter(d => d.isOriginal && daysBetween(d.date, todayStr) > 60).length), '#B5433A'],
  ];
  const rows = docRegister.filter(d => (filter === 'All' || (filter === 'Holding' ? d.status !== 'Returned to client' : d.status === filter)) && (!search.trim() || d.clientName.toLowerCase().includes(search.trim().toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date));
  function move(d: DocRecord, status: DocRecord['status']) {
    if (status === 'Returned to client' && !window.confirm(`Confirm that ${d.clientName}’s ${d.docType} has been handed back to the client?`)) return;
    setDocRegister(prev => prev.map(x => x.id === d.id ? { ...x, status, statusDate: todayStr } : x));
    logActivity(`Document ${status.toLowerCase()} — ${d.clientName}, ${d.docType}`); toast(`Marked: ${status}`);
  }
  const chip = (k: typeof filter, label: string) => <button key={k} className="btn" onClick={() => setFilter(k)} style={{ fontSize: 14.5, padding: '8px 14px', fontWeight: 700, background: filter === k ? NAVY : '#fff', color: filter === k ? '#fff' : NAVY, borderColor: filter === k ? NAVY : '#DCE5E0' }}>{label}</button>;
  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>{stats.map(([a, b, col]) => <div key={a} className="card"><div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>{a}</div><div style={{ fontSize: 26, fontWeight: 700, color: col }}>{b}</div></div>)}</div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex gap-2 flex-wrap items-center">{chip('Holding', 'Not yet returned')}{chip('With us', 'With us')}{chip('Submitted to embassy', 'At embassy')}{chip('Returned to client', 'Returned')}{chip('All', 'All')}
          <input placeholder="Search client…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 200 }} /></div>
        <button className="btn btn-primary" style={bigBtn} onClick={() => setAdding(true)}>+ Receive a document</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {rows.length === 0 ? <div style={{ padding: 22, fontSize: 15.5, color: '#5B6270' }}>No documents here.</div> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Client</th><th style={th}>Document</th><th style={th}>Received</th><th style={th}>Where is it now?</th><th style={th}></th></tr></thead>
            <tbody>{rows.map(d => (
              <tr key={d.id}><td style={td}><b>{d.clientName}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{d.phone}</div></td>
                <td style={td}>{d.docType} <b style={{ color: d.isOriginal ? '#B5433A' : '#5B6270', fontSize: 12.5 }}>{d.isOriginal ? 'ORIGINAL' : 'COPY'}</b><div style={{ fontSize: 13.5, color: '#444' }}>{d.description}</div></td>
                <td style={{ ...td, fontSize: 14 }}>{fmtDate(d.date)}<div style={{ color: '#5B6270', fontSize: 12.5 }}>{d.refNo}</div></td>
                <td style={td}><b style={{ color: d.status === 'Returned to client' ? '#0B6E4F' : d.status === 'Submitted to embassy' ? '#1F6E8C' : NAVY }}>{d.status}</b><div style={{ fontSize: 12.5, color: '#5B6270' }}>{d.status !== 'With us' ? fmtDate(d.statusDate) : isOld(d, todayStr) ? <span style={{ color: '#B5433A', fontWeight: 700 }}>held {daysBetween(d.date, todayStr)} days</span> : ''}</div></td>
                <td style={{ ...td, ...R }}><div className="flex gap-1.5 justify-end flex-wrap">
                  {d.status === 'With us' && <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => move(d, 'Submitted to embassy')}>Sent to embassy</button>}
                  {d.status !== 'Returned to client' && <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => move(d, 'Returned to client')}>Return to client</button>}
                  <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => setReceipt(d.id)}>Receipt</button></div></td></tr>))}</tbody>
          </table>}
      </div>
      <div style={{ fontSize: 14, color: '#5B6270', marginTop: 10, lineHeight: 1.6 }}>Print a receipt every time you take an original from a client, and have them sign it. It protects you and the client.</div>
      <Modal open={adding} onClose={() => setAdding(false)} wide>{adding && <DocForm onClose={() => setAdding(false)} onSaved={id => { setAdding(false); setReceipt(id); }} />}</Modal>
      <Modal open={!!receipt} onClose={() => setReceipt(null)} wide>{receipt && <DocReceipt id={receipt} onClose={() => setReceipt(null)} />}</Modal>
    </div>
  );
}
const isOld = (d: DocRecord, t: string) => d.isOriginal && daysBetween(d.date, t) > 60;

function DocForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { cases, team, docRegister, setDocRegister, logActivity } = useAppData();
  const toast = useToast();
  const [caseId, setCaseId] = useState(''); const [clientName, setClientName] = useState(''); const [phone, setPhone] = useState('');
  const [docType, setDocType] = useState(DOC_TYPES[0]); const [description, setDescription] = useState(''); const [isOriginal, setIsOriginal] = useState(true);
  const [receivedBy, setReceivedBy] = useState(''); const [notes, setNotes] = useState('');
  const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
  function pick(id: string) { setCaseId(id); const c = cases.find(x => x.id === id); if (c) { setClientName(c.name); setPhone(c.phone); } }
  function save() {
    if (!clientName.trim()) { toast('Enter the client name'); return; }
    const rec: DocRecord = { id: genId('doc'), refNo: seq('GG-DOC', docRegister), date: today(), clientName: clientName.trim(), phone, caseId, docType, description, isOriginal, receivedBy: receivedBy || 'Office', status: 'With us', statusDate: today(), notes };
    setDocRegister(prev => [...prev, rec]); logActivity(`Document received — ${rec.clientName}, ${docType}`); toast('Recorded'); onSaved(rec.id);
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>Receive a client document</ModalTitle>
      <label style={lbl}>Client’s case (optional — fills in the details)</label>
      <select value={caseId} onChange={e => pick(e.target.value)} style={inputStyle}><option value="">Not linked to a case</option>{cases.map(c => <option key={c.id} value={c.id}>{c.name} — {c.destination}</option>)}</select>
      <div className="grid grid-cols-2 gap-3">
        <div><label style={lbl}>Client name</label><input value={clientName} onChange={e => setClientName(e.target.value)} style={inputStyle} /></div>
        <div><label style={lbl}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
        <div><label style={lbl}>Document</label><select value={docType} onChange={e => setDocType(e.target.value)} style={inputStyle}>{DOC_TYPES.map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label style={lbl}>Received by</label><select value={receivedBy} onChange={e => setReceivedBy(e.target.value)} style={inputStyle}><option value="">Office</option>{staff.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
      </div>
      <label style={lbl}>Details (e.g. passport number, number of pages)</label><input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
      <label style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}><input type="checkbox" checked={isOriginal} onChange={e => setIsOriginal(e.target.checked)} style={{ width: 'auto' }} /> This is the <b>original</b> document (not a copy)</label>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save and print receipt</button></ModalFoot>
    </div>
  );
}

function DocReceipt({ id, onClose }: { id: string; onClose: () => void }) {
  const { docRegister } = useAppData();
  const d = docRegister.find(x => x.id === id)!;
  return (
    <>
      <div className="no-print flex items-center justify-between mb-3"><button className="btn btn-sm" onClick={onClose}>Close</button><button className="btn btn-sm btn-primary" onClick={printSheet}>Print / Save as PDF</button></div>
      <div id="invoice-print-area" style={{ background: '#fff', color: '#1a1a1a', fontFamily: ARIAL, padding: 4, fontSize: 15.5, lineHeight: 1.7 }}>
        <Letterhead title="DOCUMENT RECEIPT" refNo={d.refNo} date={d.date} />
        <p>GoGlobe Consultant acknowledges receipt of the following {d.isOriginal ? <b>original</b> : 'copy of the'} document from the client named below, for the purpose of visa consultancy and file preparation.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0 16px' }}><tbody>
          {[['Client', d.clientName], ['Phone', d.phone || '—'], ['Document', `${d.docType} (${d.isOriginal ? 'ORIGINAL' : 'copy'})`], ['Details', d.description || '—'], ['Received by', d.receivedBy], ['Date received', fmtDate(d.date)]].map(([a, b]) => (
            <tr key={a}><td style={{ border: '1px solid #cfd8dc', padding: '8px 12px', background: '#F2F8F5', width: 180, fontWeight: 700 }}>{a}</td><td style={{ border: '1px solid #cfd8dc', padding: '8px 12px' }}>{b}</td></tr>))}</tbody></table>
        <p style={{ fontSize: 14 }}>The company will keep this document safely and return it to the client, or submit it to the relevant embassy or authority on the client’s instruction. The client must present this receipt to collect the document.</p>
        <div className="avoid-break" style={{ display: 'flex', gap: 48, margin: '44px 0 8px' }}><div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>CLIENT SIGNATURE</div><div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>RECEIVED BY (COMPANY)</div></div>
        <Footer />
      </div>
    </>
  );
}

// =====================================================================
// STAFF LETTERS
// =====================================================================
const LETTER_TYPES = ['Experience Certificate', 'Salary Certificate', 'Appointment Letter', 'Warning Letter'] as const;
const EXTRA_LABEL: Record<string, string> = { 'Experience Certificate': 'Extra line about their work (optional)', 'Salary Certificate': 'Purpose (e.g. visa application, bank)', 'Appointment Letter': 'Extra terms (optional)', 'Warning Letter': 'What is the warning about?' };

function draftLetter(type: string, t: TeamMember, extra: string): string {
  const allowance = t.monthlyAllowance || 0; const gross = t.salary + allowance;
  const since = t.contractStart ? ` since ${fmtDate(t.contractStart)}` : '';
  const left = (t.employmentStatus === 'Resigned' || t.employmentStatus === 'Terminated') && t.lastWorkingDay;
  if (type === 'Experience Certificate') return `TO WHOM IT MAY CONCERN\n\nThis is to certify that ${t.name} (Employee ID: ${t.employeeId}) ${left ? 'worked' : 'is working'} with GoGlobe Consultant as ${t.role} in the ${t.department} department${left ? ` from ${t.contractStart ? fmtDate(t.contractStart) : 'the date of joining'} to ${fmtDate(t.lastWorkingDay)}` : since}.\n\nDuring this period, ${t.name} performed the assigned duties with sincerity and professionalism.${extra ? ' ' + extra : ''}\n\nThis certificate is issued on request, and we wish ${t.name} every success in the future.`;
  if (type === 'Salary Certificate') return `TO WHOM IT MAY CONCERN\n\nThis is to certify that ${t.name} (Employee ID: ${t.employeeId}) is employed with GoGlobe Consultant as ${t.role}${since}.\n\nThe current gross monthly salary is PKR ${gross.toLocaleString()} (${rupeesInWords(gross)}), made up of a basic salary of PKR ${t.salary.toLocaleString()}${allowance ? ` and a monthly allowance of PKR ${allowance.toLocaleString()}` : ''}.\n\nThis certificate is issued on request${extra ? ` for ${extra}` : ''}, without any liability on the part of the company.`;
  if (type === 'Appointment Letter') return `Dear ${t.name},\n\nWe are pleased to appoint you as ${t.role} in the ${t.department} department of GoGlobe Consultant${t.contractStart ? `, effective ${fmtDate(t.contractStart)}` : ''}.\n\nYour monthly remuneration will be PKR ${gross.toLocaleString()} (basic salary PKR ${t.salary.toLocaleString()}${allowance ? ` plus allowance PKR ${allowance.toLocaleString()}` : ''}). Your working hours are ${t.shiftStart} to ${t.shiftEnd}.${t.contractType === 'Probation' ? ' Your employment begins with a probation period, after which your performance will be reviewed.' : ''}\n\nYou are expected to follow company policy, keep all client information confidential, and accept client payments only into the official company account.${extra ? '\n\n' + extra : ''}\n\nPlease sign the duplicate copy of this letter to confirm your acceptance. We welcome you to the team.`;
  return `Dear ${t.name},\n\nThis letter is a formal warning regarding: ${extra || '[describe the issue]'}.\n\nSuch conduct is not in line with company policy. You are advised to correct it immediately. Further incidents may lead to disciplinary action, including fines or termination of employment.\n\nPlease sign below to confirm that you have received and understood this letter.`;
}

export function StaffLetters() {
  const { letters } = useAppData();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const list = letters.slice().sort((a, b) => b.date.localeCompare(a.date) || b.refNo.localeCompare(a.refNo));
  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div style={{ fontSize: 15, color: '#5B6270', maxWidth: 650, lineHeight: 1.6 }}>Pick an employee and a letter type — the wording is filled in from their record. Edit it if you need to, then print on company letterhead. Every letter is kept here with its reference number.</div>
        <button className="btn btn-primary" style={bigBtn} onClick={() => setCreating(true)}>+ New letter</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {list.length === 0 ? <div style={{ padding: 22, fontSize: 15.5, color: '#5B6270' }}>No letters issued yet.</div> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Reference</th><th style={th}>Employee</th><th style={th}>Letter</th><th style={th}>Date</th><th style={th}></th></tr></thead>
            <tbody>{list.map(l => <tr key={l.id}><td style={td}>{l.refNo}</td><td style={td}><b>{l.staffName}</b></td><td style={td}>{l.type}</td><td style={td}>{fmtDate(l.date)}</td><td style={{ ...td, ...R }}><button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => setView(l.id)}>View / print</button></td></tr>)}</tbody>
          </table>}
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} wide>{creating && <LetterForm onClose={() => setCreating(false)} onSaved={id => { setCreating(false); setView(id); }} />}</Modal>
      <Modal open={!!view} onClose={() => setView(null)} wide>{view && <LetterView id={view} onClose={() => setView(null)} />}</Modal>
    </div>
  );
}

function LetterForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { team, letters, setLetters, logActivity } = useAppData();
  const toast = useToast();
  const [staffId, setStaffId] = useState(team[0]?.id || ''); const [type, setType] = useState<string>(LETTER_TYPES[0]); const [extra, setExtra] = useState('');
  const t = team.find(x => x.id === staffId);
  const [body, setBody] = useState(t ? draftLetter(LETTER_TYPES[0], t, '') : '');
  const regen = (nt: string, sid: string, ex: string) => { const s = team.find(x => x.id === sid); if (s) setBody(draftLetter(nt, s, ex)); };
  function save() {
    if (!t || !body.trim()) return;
    const rec: Letter = { id: genId('ltr'), refNo: seq('GG-LTR', letters), staffId: t.id, staffName: t.name, type, date: today(), body };
    setLetters(prev => [...prev, rec]); logActivity(`${type} issued — ${t.name}`); toast('Letter saved'); onSaved(rec.id);
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>New letter</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <div><label style={lbl}>Employee</label><select value={staffId} onChange={e => { setStaffId(e.target.value); regen(type, e.target.value, extra); }} style={inputStyle}>{team.map(x => <option key={x.id} value={x.id}>{x.name} — {x.role}</option>)}</select></div>
        <div><label style={lbl}>Letter</label><select value={type} onChange={e => { setType(e.target.value); regen(e.target.value, staffId, extra); }} style={inputStyle}>{LETTER_TYPES.map(l => <option key={l}>{l}</option>)}</select></div>
      </div>
      <label style={lbl}>{EXTRA_LABEL[type]}</label><input value={extra} onChange={e => { setExtra(e.target.value); regen(type, staffId, e.target.value); }} style={inputStyle} />
      <label style={lbl}>Letter text (you can edit it)</label><textarea rows={11} value={body} onChange={e => setBody(e.target.value)} style={{ ...inputStyle, lineHeight: 1.6 }} />
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save and print</button></ModalFoot>
    </div>
  );
}

function LetterView({ id, onClose }: { id: string; onClose: () => void }) {
  const { letters } = useAppData();
  const l = letters.find(x => x.id === id)!;
  const needsSign = l.type === 'Appointment Letter' || l.type === 'Warning Letter';
  const sig: CSSProperties = { flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 };
  return (
    <>
      <div className="no-print flex items-center justify-between mb-3"><button className="btn btn-sm" onClick={onClose}>Close</button><button className="btn btn-sm btn-primary" onClick={printSheet}>Print / Save as PDF</button></div>
      <div id="invoice-print-area" style={{ background: '#fff', color: '#1a1a1a', fontFamily: ARIAL, padding: 4 }}>
        <Letterhead title={l.type.toUpperCase()} refNo={l.refNo} date={l.date} />
        <div style={{ fontSize: 16, lineHeight: 1.75, whiteSpace: 'pre-wrap', minHeight: 330 }}>{l.body}</div>
        <div className="avoid-break" style={{ marginTop: 26, fontSize: 15.5 }}>Yours sincerely,<div style={{ height: 46 }} /><div style={{ borderTop: '1px solid #333', display: 'inline-block', paddingTop: 5, minWidth: 260 }}><b>Authorized Signatory</b><br />GoGlobe Consultant</div></div>
        {needsSign && <div className="avoid-break" style={{ display: 'flex', gap: 48, marginTop: 30 }}><div style={sig}>EMPLOYEE SIGNATURE &amp; DATE</div><div style={{ flex: 1 }} /></div>}
        <Footer />
      </div>
    </>
  );
}
