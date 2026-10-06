'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, genId, today, DEPARTMENTS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { Modal, ModalTitle, ModalFoot } from '@/components/ui/Primitives';
import { ARIAL, NAVY, inputStyle, lbl, bigBtn } from '@/components/ui/docStyles';
import type { Announcement } from '@/lib/types';

const sorted = (l: Announcement[]) => l.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));

// What an employee sees at the top of their own portal.
export function AnnouncementsPanel({ dept }: { dept: string }) {
  const { announcements } = useAppData();
  const list = sorted(announcements.filter(a => a.audience === 'All' || a.audience === dept)).slice(0, 5);
  if (!list.length) return null;
  return (
    <div className="card mb-4" style={{ fontFamily: ARIAL, borderLeft: '4px solid #C9922E' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#8a5a12', marginBottom: 8 }}>ANNOUNCEMENTS</div>
      {list.map(a => (
        <div key={a.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{a.pinned ? '📌 ' : ''}{a.title} <span style={{ fontSize: 12.5, fontWeight: 400, color: '#5B6270' }}>· {fmtDate(a.date)}</span></div>
          <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.body}</div>
        </div>))}
    </div>
  );
}

export function Announcements() {
  const { announcements, setAnnouncements, logActivity } = useAppData();
  const toast = useToast();
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null);
  function remove(a: Announcement) {
    if (!window.confirm(`Delete “${a.title}”? Employees will no longer see it.`)) return;
    setAnnouncements(prev => prev.filter(x => x.id !== a.id)); logActivity(`Announcement deleted — ${a.title}`); toast('Deleted');
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div style={{ fontSize: 15, color: '#5B6270', maxWidth: 640, lineHeight: 1.6 }}>Post a notice for everyone or for one department. It appears at the top of each employee’s own portal as soon as they log in. Employees can read announcements but cannot change them.</div>
        <button className="btn btn-primary" style={bigBtn} onClick={() => setEditing('new')}>+ New announcement</button>
      </div>
      {announcements.length === 0 && <div className="card" style={{ fontSize: 15.5, color: '#5B6270' }}>No announcements yet.</div>}
      <div className="flex flex-col gap-3">
        {sorted(announcements).map(a => (
          <div key={a.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div><div style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>{a.pinned ? '📌 ' : ''}{a.title}</div>
                <div style={{ fontSize: 13.5, color: '#5B6270', margin: '2px 0 8px' }}>{fmtDate(a.date)} · for {a.audience === 'All' ? 'everyone' : `${a.audience} team`}</div>
                <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.body}</div></div>
              <div className="flex gap-1.5 flex-none"><button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => setEditing(a)}>Edit</button><button className="btn btn-sm btn-ghost btn-danger" style={{ fontSize: 14 }} onClick={() => remove(a)}>Delete</button></div>
            </div>
          </div>))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} wide>{editing && <AnnouncementForm existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}</Modal>
    </div>
  );
}

function AnnouncementForm({ existing, onClose }: { existing: Announcement | null; onClose: () => void }) {
  const { setAnnouncements, logActivity } = useAppData();
  const toast = useToast();
  const [title, setTitle] = useState(existing?.title || ''); const [body, setBody] = useState(existing?.body || '');
  const [audience, setAudience] = useState(existing?.audience || 'All'); const [pinned, setPinned] = useState(existing?.pinned || false);
  function save() {
    if (!title.trim() || !body.trim()) { toast('Add a title and the message'); return; }
    if (existing) setAnnouncements(prev => prev.map(x => x.id === existing.id ? { ...x, title: title.trim(), body, audience, pinned } : x));
    else setAnnouncements(prev => [...prev, { id: genId('ann'), date: today(), title: title.trim(), body, audience, pinned, createdBy: 'Management' }]);
    logActivity(`Announcement ${existing ? 'updated' : 'posted'} — ${title}`); toast(existing ? 'Updated' : 'Posted — employees will see it now'); onClose();
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>{existing ? 'Edit announcement' : 'New announcement'}</ModalTitle>
      <label style={lbl}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Office closed on Friday" />
      <label style={lbl}>Message</label><textarea rows={5} value={body} onChange={e => setBody(e.target.value)} style={inputStyle} />
      <div className="grid grid-cols-2 gap-3">
        <div><label style={lbl}>Who should see it?</label><select value={audience} onChange={e => setAudience(e.target.value)} style={inputStyle}><option value="All">Everyone</option>{(DEPARTMENTS as readonly string[]).map(d => <option key={d} value={d}>{d} team only</option>)}</select></div>
        <div><label style={lbl}>Keep at the top?</label><label style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} style={{ width: 'auto' }} /> Pin this announcement</label></div>
      </div>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{existing ? 'Save' : 'Post'}</button></ModalFoot>
    </div>
  );
}
