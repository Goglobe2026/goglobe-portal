'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { genId } from '@/lib/constants';
import { myMessageId, threadWith, unreadFor } from '@/lib/messages';
import { useToast } from '@/components/ui/Toast';

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
  return day === todayStr ? t : `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Karachi' })} ${t}`;
}

// Private one-to-one chat. The server only ever sends you the messages you
// sent or received, so nobody else's conversation is even in this browser.
export function TeamMessages({ embedded = false }: { embedded?: boolean }) {
  const { session, team, messages, setMessages, refresh } = useAppData();
  const toast = useToast();
  const me = myMessageId(session);
  const [other, setOther] = useState<string>('');
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // People you can write to: everyone on the team, plus the Head Manager.
  const contacts = useMemo(() => {
    const list = team
      .filter(t => t.id !== me && (!t.employmentStatus || t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave'))
      .map(t => ({ id: t.id, name: t.name, sub: t.role || t.department }));
    if (me !== 'ceo') list.unshift({ id: 'ceo', name: 'Head Manager', sub: 'Head of the company' });
    return list.map(c => {
      const th = threadWith(messages, me, c.id);
      return { ...c, last: th[th.length - 1], unread: th.filter(m => m.to === me && !m.readAt).length };
    }).sort((a, b) => (b.last?.at || '').localeCompare(a.last?.at || '') || a.name.localeCompare(b.name));
  }, [team, messages, me]);

  // Pick the first conversation on open (prefer one with something unread).
  useEffect(() => {
    if (!other && contacts.length) setOther((contacts.find(c => c.unread)?.id) || contacts[0].id);
  }, [contacts, other]);

  // New messages arrive quickly while this page is open.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(['messages']); }, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const thread = other ? threadWith(messages, me, other) : [];
  const otherName = contacts.find(c => c.id === other)?.name || '';

  // Opening a chat marks what you received as read.
  const unreadHere = thread.filter(m => m.to === me && !m.readAt).map(m => m.id);
  useEffect(() => {
    if (!unreadHere.length) return;
    const now = new Date().toISOString();
    setMessages(prev => prev.map(m => unreadHere.includes(m.id) ? { ...m, readAt: now } : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadHere.join(',')]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread.length, other]);

  function send() {
    const t = text.trim();
    if (!t || !other) return;
    if (t.length > 4000) { toast('That message is too long — keep it under 4,000 characters'); return; }
    setMessages(prev => [...prev, { id: genId('ms'), from: me, to: other, text: t, at: new Date().toISOString() }]);
    setText('');
  }

  if (!me) return null;
  return (
    <div className="card p-0 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: embedded ? '220px 1fr' : '280px 1fr', height: embedded ? 460 : 'calc(100vh - 190px)', minHeight: 420 }}>
      <div style={{ borderRight: '1px solid var(--line)', overflowY: 'auto' }}>
        {contacts.map(c => (
          <button key={c.id} onClick={() => setOther(c.id)} className="w-full text-left px-3.5 py-3 block" data-contact={c.name}
            style={{ background: other === c.id ? 'var(--navy-50)' : 'transparent', borderBottom: '1px solid var(--line)', cursor: 'pointer', borderLeft: other === c.id ? '3px solid var(--navy)' : '3px solid transparent' }}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[13.5px] flex-1 truncate">{c.name}</span>
              {c.unread > 0 && <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--red)', color: '#fff' }}>{c.unread}</span>}
            </div>
            <div className="text-[11.5px] text-[var(--muted)] truncate">{c.last ? `${c.last.from === me ? 'You: ' : ''}${c.last.text}` : c.sub}</div>
          </button>
        ))}
        {!contacts.length && <div className="p-4 text-[13px] text-[var(--muted)]">No one to message yet.</div>}
      </div>

      <div className="flex flex-col min-h-0">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="font-semibold text-[14px]">{otherName || 'Choose a person'}</div>
          <div className="text-[11.5px] text-[var(--muted)]">🔒 Private — only you and {otherName || 'them'} can read this chat.</div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ background: '#F7FBF9' }} data-thread>
          {!thread.length && other && <div className="text-center text-[13px] text-[var(--muted)] my-auto">No messages yet — say hello to {otherName}.</div>}
          {thread.map(m => {
            const mine = m.from === me;
            return (
              <div key={m.id} className="max-w-[75%] rounded-2xl px-3.5 py-2 text-[13.5px]" data-msg={mine ? 'mine' : 'theirs'}
                style={{ alignSelf: mine ? 'flex-end' : 'flex-start', background: mine ? 'var(--navy)' : '#fff', color: mine ? '#fff' : 'var(--ink)', border: mine ? 'none' : '1px solid var(--line)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {m.text}
                <div className="text-[10.5px] mt-1" style={{ opacity: .7, textAlign: 'right' }}>{timeLabel(m.at)}{mine && (m.readAt ? ' · seen' : '')}</div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="p-3 flex gap-2 items-end" style={{ borderTop: '1px solid var(--line)' }}>
          <textarea rows={2} value={text} placeholder={other ? `Message ${otherName}…  (Enter to send, Shift+Enter for a new line)` : 'Choose a person first'} disabled={!other}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} style={{ resize: 'none' }} />
          <button className="btn btn-primary" onClick={send} disabled={!other || !text.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}
