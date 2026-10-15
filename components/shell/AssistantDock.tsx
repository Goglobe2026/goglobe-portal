'use client';
import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/icons';
import { themeVars } from '@/lib/moduleTheme';
import { AssistantChat } from './AssistantChat';
import { assistant, useAssistantData, useAssistantStore } from './useAssistant';

// Open the chat window from anywhere (the home screen, the top bar, a button on a lead…),
// optionally with a question already asked.
export function openAssistant(q?: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('open-assistant', { detail: { q } }));
}

// A round button in the corner of every screen. It opens the assistant in a panel that slides in
// from the right, so whatever you were doing stays visible behind it. Ctrl/⌘ + K toggles it, Esc closes it.
export function AssistantDock() {
  const st = useAssistantStore();
  const { build } = useAssistantData();
  const buildRef = useRef(build); buildRef.current = build;
  const open = st.open;

  useEffect(() => {
    const onOpen = (e: Event) => {
      assistant.setOpen(true);
      const q = (e as CustomEvent<{ q?: string }>).detail?.q;
      if (q) setTimeout(() => assistant.ask(q, () => buildRef.current()), 60);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); assistant.setOpen(!open); }
      else if (e.key === 'Escape' && open) assistant.setOpen(false);
    };
    window.addEventListener('open-assistant', onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('open-assistant', onOpen); window.removeEventListener('keydown', onKey); };
  }, [open]);

  // put the cursor in the question box when the panel opens
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid=assistant-input]')?.focus(), 260);
    return () => clearTimeout(t);
  }, [open]);

  const vars = themeVars('assistant') as React.CSSProperties;
  return (
    <div className="themed no-print" style={{ ...vars, position: 'static', background: 'transparent' }}>
      {!open && (
        <button onClick={() => assistant.setOpen(true)} data-testid="assistant-fab" title="Ask the assistant (Ctrl+K)" aria-label="Open the assistant"
          style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 70, width: 58, height: 58, borderRadius: 20, border: '1px solid rgba(255,255,255,.35)', cursor: 'pointer', color: '#fff',
            background: 'linear-gradient(135deg, var(--accent-2), var(--accent))', boxShadow: '0 18px 34px -12px var(--accent-glow), 0 4px 10px rgba(20,33,61,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .18s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>
          <Icon id="assistant" size={26} stroke="#fff" />
        </button>
      )}
      {open && <div onClick={() => assistant.setOpen(false)} aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 79, background: 'rgba(14,27,54,.28)', backdropFilter: 'blur(2px)', animation: 'fade .2s both' }} />}
      {open && (
        <aside role="dialog" aria-label="Assistant" data-testid="assistant-panel"
          style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 80, width: 'min(460px, 100vw)', background: 'linear-gradient(180deg, #fff, var(--accent-soft))', display: 'flex', flexDirection: 'column', boxShadow: '-30px 0 60px -30px rgba(14,27,54,.45)', animation: 'slidein .28s cubic-bezier(.2,.8,.2,1) both' }}>
          <AssistantChat variant="dock" onClose={() => assistant.setOpen(false)} />
        </aside>
      )}
    </div>
  );
}
