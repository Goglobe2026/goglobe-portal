'use client';
import { NAV_GROUPS } from '@/lib/navGroups';
import type { ReactElement } from 'react';

// One consistent icon per group, all drawn in the same gold, so visual
// distinction comes from iconography — not from six different hues that
// don't relate to the brand.
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
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2">
        {NAV_GROUPS.map(g => (
          <button key={g.id} onClick={() => onOpen(g.id)}
            className="text-left rounded-2xl p-6 text-white transition-transform hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(155deg, #14213D 0%, #1B3358 100%)',
              border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', minHeight: 132,
            }}>
            <div className="w-11 h-11 rounded-[11px] flex items-center justify-center mb-4" style={{ background: 'rgba(201,146,46,.16)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8C784" strokeWidth="1.8">
                {ICONS[g.id]}
              </svg>
            </div>
            <div className="font-display text-[18px] font-semibold mb-1.5">{g.label}</div>
            <div className="text-[12.5px]" style={{ opacity: 0.78 }}>{g.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
