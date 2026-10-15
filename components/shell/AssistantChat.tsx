'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { startersFor, type Block, type Reply } from '@/lib/assistant/engine';
import { assistant, gotoTab, useAssistantData, useAssistantStore, type ChatMsg } from './useAssistant';

const TONE: Record<string, string> = { bad: 'hsl(4 66% 46%)', warn: 'hsl(32 88% 40%)', good: 'hsl(152 60% 30%)' };
const waLink = (phone: string, text: string) => `https://wa.me/${(phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(text)}`;

function useCopy() {
  const toast = useToast();
  return async (text: string, done = 'Copied') => {
    try { await navigator.clipboard.writeText(text); toast(done); }
    catch {
      try { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast(done); }
      catch { toast('Could not copy — select the text and copy it by hand'); }
    }
  };
}

function BlockView({ b, i, phone, canGo, onGo, copy }: { b: Block; i: number; phone: string; canGo: boolean; onGo: (tab: string) => void; copy: (t: string, m?: string) => void }) {
  const anim: CSSProperties = { animation: 'rise .35s both', animationDelay: `${Math.min(i, 8) * 55}ms` };
  switch (b.t) {
    case 'h': return <div style={{ ...anim, fontWeight: 700, color: 'var(--accent-ink)', fontSize: 14, margin: i ? '12px 0 4px' : '0 0 4px', fontFamily: 'var(--font-display, inherit)' }}>{b.text}</div>;
    case 'p': return <div style={{ ...anim, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{b.text}</div>;
    case 'steps': return (
      <ol style={{ ...anim, listStyle: 'none', margin: '2px 0 10px', padding: 0 }}>
        {b.items.map((s, k) => (
          <li key={k} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', margin: '0 0 6px' }}>
            <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 999, background: 'var(--accent-soft-2)', color: 'var(--accent-ink)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{k + 1}</span>
            <span>{s}</span>
          </li>))}
      </ol>);
    case 'bullets': return (
      <ul style={{ ...anim, margin: '2px 0 10px', padding: 0, listStyle: 'none' }}>
        {b.items.map((s, k) => <li key={k} style={{ display: 'flex', gap: 8, margin: '0 0 4px' }}><span style={{ color: 'var(--accent)', flex: 'none' }}>•</span><span>{s}</span></li>)}
      </ul>);
    case 'say': return (
      <div style={{ ...anim, margin: '4px 0 10px', borderRadius: 12, border: '1px solid var(--accent-line)', borderLeft: '4px solid var(--accent)', background: 'var(--accent-soft)', padding: '9px 12px' }}>
        {b.label && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent-ink)', opacity: .8, marginBottom: 3 }}>{b.label}</div>}
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.3 }} data-testid="assistant-say">{b.text}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => copy(b.text, 'Message copied')}>Copy</button>
          {phone ? <a className="btn btn-sm" style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff', borderColor: 'transparent' }} target="_blank" rel="noreferrer" href={waLink(phone, b.text)}>WhatsApp</a>
            : <a className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(b.text)}`}>Send on WhatsApp</a>}
        </div>
      </div>);
    case 'rows': return (
      <div style={{ ...anim, margin: '2px 0 10px', border: '1px solid var(--accent-line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        {b.items.map((r, k) => {
          const click = r.go && canGo ? () => onGo(r.go as string) : undefined;
          return (
            <div key={k} onClick={click} role={click ? 'button' : undefined} data-testid="assistant-row"
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', borderTop: k ? '1px solid var(--accent-line)' : 'none', cursor: click ? 'pointer' : 'default', background: k % 2 ? 'var(--accent-soft)' : '#fff' }}>
              <span style={{ flex: 'none', width: 8, height: 8, borderRadius: 999, marginTop: 6, background: r.tone ? TONE[r.tone] : 'var(--accent-mid)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.tone ? TONE[r.tone] : 'var(--accent-ink)', textAlign: 'right' }}>{r.value}</span>
                </div>
                {r.sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{r.sub}</div>}
              </div>
              {click && <span style={{ color: 'var(--accent)', flex: 'none' }}>›</span>}
            </div>);
        })}
      </div>);
    case 'note': return (
      <div style={{ ...anim, margin: '2px 0 8px', fontSize: 12.3, lineHeight: 1.5, padding: '7px 10px', borderRadius: 10, background: b.tone === 'warn' ? 'hsl(40 90% 94%)' : 'var(--accent-soft-2)', color: b.tone === 'warn' ? 'hsl(32 70% 26%)' : 'var(--accent-ink)' }}>{b.text}</div>);
  }
}

export function AssistantChat({ variant, onClose }: { variant: 'dock' | 'inline'; onClose?: () => void }) {
  const st = useAssistantStore();
  const { build, role } = useAssistantData();
  const { session, team, leads } = useAppData();
  const copy = useCopy();
  const [q, setQ] = useState('');
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const me = session?.type === 'employee' ? team.find(t => t.id === session.staffId) : null;
  const canGo = session?.type === 'ceo' || !!me?.isAdmin;
  const starters = useMemo(() => startersFor(role), [role]);
  const lastBot = [...st.msgs].reverse().find(m => m.role === 'bot' && m.reply && !m.pending);

  const ask = (text: string) => { assistant.ask(text, build); setQ(''); };
  const go = (tab: string) => { gotoTab(tab); if (variant === 'dock') onClose?.(); };

  // keep the start of the newest answer in view, not the end of a long one
  useEffect(() => {
    const t = thread.current; if (!t) return;
    const users = t.querySelectorAll('[data-role=user]');
    const last = users[users.length - 1] as HTMLElement | undefined;
    if (last) t.scrollTo({ top: Math.max(0, last.offsetTop - 8), behavior: 'smooth' }); else t.scrollTop = 0;
  }, [st.msgs.length, st.msgs[st.msgs.length - 1]?.pending]);

  const nameOfLead = (reply?: Reply) => (reply?.memory.leadId ? leads.find(l => l.id === reply.memory.leadId) : undefined);

  const welcome = (
    <div style={{ padding: variant === 'dock' ? '6px 2px' : '4px 0' }} data-testid="assistant-welcome">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent-2), var(--accent))', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 22px -12px var(--accent-glow)' }}><Icon id="assistant" size={22} stroke="#fff" /></span>
        <div>
          <div className="font-display" style={{ fontSize: 17, fontWeight: 600, color: 'var(--accent-ink)' }}>{role === 'head' ? 'Ask me about the business' : 'Ask me about your day'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>English or Roman Urdu — I read your portal and the company guide.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: '12px 0' }}>
        {starters.map(s => <button key={s} className="btn btn-sm" data-testid="assistant-starter" style={{ borderRadius: 999 }} onClick={() => ask(s)}>{s}</button>)}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, borderTop: '1px dashed var(--accent-line)', paddingTop: 10 }}>
        I work without any AI service or key, so I only know this business, its visa work and this portal. When I am not sure I say so — I never guess a fee, a waiting time or an embassy rule.
      </div>
    </div>
  );

  const body = (
    <div ref={thread} data-testid="assistant-thread" style={{ flex: 1, overflowY: 'auto', padding: variant === 'dock' ? '16px 16px 8px' : '4px 2px 8px', maxHeight: variant === 'inline' ? 520 : undefined, minHeight: variant === 'inline' ? 220 : undefined, position: 'relative' }}>
      {!st.msgs.length && welcome}
      {st.msgs.map(m => <MsgView key={m.id} m={m} isLast={lastBot?.id === m.id} phone={nameOfLead(m.reply)?.phone || ''} canGo={canGo} onGo={go} onAsk={ask} copy={copy} />)}
    </div>
  );

  const composer = (
    <form onSubmit={e => { e.preventDefault(); ask(q); }} style={{ display: 'flex', gap: 8, padding: variant === 'dock' ? '10px 14px 14px' : '6px 0 0', borderTop: variant === 'dock' ? '1px solid var(--accent-line)' : 'none', background: variant === 'dock' ? '#fff' : undefined }}>
      <input ref={input} data-testid="assistant-input" value={q} onChange={e => setQ(e.target.value)} maxLength={400} autoComplete="off"
        placeholder={role === 'head' ? 'e.g. Who owes us money?' : 'e.g. What should I do today?'} style={{ flex: 1, borderRadius: 12 }} aria-label="Ask the assistant" />
      <button className="btn btn-primary" type="submit" data-testid="assistant-send" disabled={st.busy || !q.trim()} style={{ borderRadius: 12 }}>Ask</button>
    </form>
  );

  if (variant === 'inline') {
    return (
      <div data-testid="assistant-inline">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <span className="chip"><span style={{ width: 7, height: 7, borderRadius: 999, background: 'hsl(152 60% 38%)' }} />Built-in assistant · no key needed</span>
          {st.msgs.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => assistant.reset()}>Start a new chat</button>}
        </div>
        {body}{composer}
      </div>
    );
  }
  return (
    <>
      <div style={{ padding: '14px 16px', color: '#fff', background: 'linear-gradient(135deg, var(--hero-a), var(--hero-b))', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--hero-pattern)', opacity: .5 }} />
        <span style={{ position: 'relative', width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon id="assistant" size={19} stroke="#fff" /></span>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div className="font-display" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>GoGlobe Assistant</div>
          <div style={{ fontSize: 11.5, opacity: .85 }}>Your portal + the company guide · works without any key</div>
        </div>
        {st.msgs.length > 0 && <button onClick={() => assistant.reset()} title="Start a new chat" data-testid="assistant-new" style={iconBtn}>↺</button>}
        <button onClick={onClose} title="Close (Esc)" data-testid="assistant-close" style={iconBtn}>✕</button>
      </div>
      {body}{composer}
    </>
  );
}

const iconBtn: CSSProperties = { position: 'relative', width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer', fontSize: 14 };

function MsgView({ m, isLast, phone, canGo, onGo, onAsk, copy }: { m: ChatMsg; isLast: boolean; phone: string; canGo: boolean; onGo: (t: string) => void; onAsk: (q: string) => void; copy: (t: string, msg?: string) => void }) {
  if (m.role === 'user') return <div data-role="user" data-testid="assistant-user" style={{ display: 'flex', margin: '10px 0 8px' }}><div className="bubble me">{m.text}</div></div>;
  if (m.pending || !m.reply) return <div style={{ margin: '4px 0 10px' }} data-testid="assistant-typing"><div className="bubble bot"><span className="typing"><span /><span /><span /></span></div></div>;
  const r = m.reply;
  return (
    <div style={{ margin: '4px 0 14px' }} data-testid="assistant-reply" data-intent={r.intent}>
      <div style={{ background: '#fff', border: '1px solid var(--accent-line)', borderRadius: '6px 16px 16px 16px', padding: '12px 14px', fontSize: 13.5, lineHeight: 1.55, boxShadow: '0 10px 26px -20px rgba(20,33,61,.4)', maxWidth: '100%' }}>
        {r.blocks.map((b, i) => <BlockView key={i} b={b} i={i} phone={phone} canGo={canGo} onGo={onGo} copy={copy} />)}
      </div>
      {(r.go.length > 0 && canGo || r.follow.length > 0 || isLast) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {canGo && r.go.map(g => <button key={g.tab} className="btn btn-sm btn-primary" data-testid="assistant-go" onClick={() => onGo(g.tab)} style={{ borderRadius: 999 }}>{g.label} →</button>)}
          {r.follow.map(f => <button key={f} className="btn btn-sm" data-testid="assistant-follow" onClick={() => onAsk(f)} style={{ borderRadius: 999 }}>{f}</button>)}
          {isLast && (
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => onAsk('shorter')} data-testid="assistant-shorter">Shorter</button>
              <button className="btn btn-sm btn-ghost" onClick={() => onAsk(/\burdu\b/i.test(r.memory.lastQ || '') || r.memory.pref === 'ur' ? 'in English' : 'in Roman Urdu')} data-testid="assistant-lang">{r.memory.pref === 'ur' ? 'In English' : 'In Roman Urdu'}</button>
              <button className="btn btn-sm btn-ghost" onClick={() => onAsk('more detail')} data-testid="assistant-more">More detail</button>
              <button className="btn btn-sm btn-ghost" onClick={() => copy(r.plain, 'Answer copied')} data-testid="assistant-copy">Copy answer</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
