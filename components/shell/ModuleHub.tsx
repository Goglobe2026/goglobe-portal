'use client';
import { NAV_GROUPS } from '@/lib/navGroups';
import type { ReactElement } from 'react';

// One consistent icon per group, all drawn in the same navy, so visual
// distinction comes from iconography, not from a wall of dark color —
// the cards stay light and open, matching the rest of the site.
const ICONS: Record<string, ReactElement> = {
  dashboard: (
    <path d="M4 19V11M11 19V5M18 19V13" strokeLinecap="round" strokeLinejoin="round" />
  ),
  'grp-marketing': (
    <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8M17 5a8 8 0 010 14" strokeLinecap="round" strokeLinejoin="round" />
  ),
  'grp-cases': (
    <path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
  ),
  grouptours: (
    <path d="M21 16v-2l-8-5V4.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V18l-2.5 2v1.5l4-1 4 1V20l-2.5-2v-4.5l8 2.5z" strokeLinecap="round" strokeLinejoin="round" />
  ),
  'grp-hr': (
    <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.5-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M16 20c0-2.5-1.5-4-3.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
  ),
  'grp-finance': (
    <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M7 15h4" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

export function ModuleHub({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-5 max-md:grid-cols-2">
        {NAV_GROUPS.map(g => (
          <button key={g.id} onClick={() => onOpen(g.id)}
            className="group text-left rounded-2xl p-7 bg-white transition-all hover:-translate-y-0.5"
            style={{
              border: '1px solid var(--line)',
              boxShadow: '0 1px 2px rgba(20,33,61,.04)',
              cursor: 'pointer', minHeight: 150,
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 28px rgba(20,33,61,.09)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(20,33,61,.04)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center mb-5" style={{ background: 'var(--gold-50)' }}>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#14213D" strokeWidth="1.7">
                {ICONS[g.id]}
              </svg>
            </div>
            <div className="font-display text-[19px] font-semibold mb-2" style={{ color: '#14213D' }}>{g.label}</div>
            <div className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>{g.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
