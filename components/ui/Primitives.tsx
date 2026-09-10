'use client';
import { ReactNode } from 'react';

export function Stamp({ text, className = '' }: { text: string; className?: string }) {
  const key = text.toLowerCase().replace(/\s+/g, '-');
  const map: Record<string, string> = {
    new: 'st-new', scheduled: 'st-scheduled', contacted: 'st-contacted', active: 'st-active',
    qualified: 'st-qualified', converted: 'st-converted', approved: 'st-approved',
    completed: 'st-completed', lost: 'st-lost', closed: 'st-closed',
    refused: 'st-refused', missed: 'st-missed',
    'watching-for-slot': 'st-contacted', pending: 'st-refused', rejected: 'st-refused',
    open: 'st-approved', 'limited-seats': 'st-contacted', full: 'st-refused',
    given: 'st-approved', taken: 'st-contacted', 'paid-off': 'st-approved',
    'on-leave': 'st-contacted', resigned: 'st-lost', terminated: 'st-refused',
    late: 'st-refused', 'on-approved-leave': 'st-contacted',
    registered: 'st-new', 'partially-paid': 'st-contacted', 'fully-paid': 'st-approved',
    'documentation-complete': 'st-approved', 'travel-confirmed': 'st-approved', cancelled: 'st-refused',
  };
  const cls = map[key] || 'st-new';
  return (
    <span className={`stamp ${cls} ${className}`}>
      <span className="stamp-dot" />
      {text}
    </span>
  );
}

export function Modal({ open, onClose, children, wide = false }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-5"
      style={{ background: 'rgba(15,42,34,.45)', backdropFilter: 'blur(3px)', paddingTop: '5vh' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl w-full p-6"
        style={{ maxWidth: wide ? 720 : 540, boxShadow: '0 30px 70px rgba(11,110,79,.28)' }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-display text-[17px] font-semibold mb-4 mt-0">{children}</h3>;
}

export function ModalFoot({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 mt-2">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function SectionHead({ title, count, action }: { title: string; count?: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between my-6 first:mt-0 flex-wrap gap-2">
      <h2 className="font-display text-base font-semibold m-0">{title}</h2>
      {count && <span className="text-xs text-[var(--muted)]">{count}</span>}
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card text-center py-9 px-3 text-[var(--muted)]">
      <b className="block font-display text-[15px] font-semibold text-[var(--ink)] mb-1">{title}</b>
      {body}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
