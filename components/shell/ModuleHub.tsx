'use client';
import { NAV_GROUPS } from '@/lib/navGroups';

const HUB_COLORS: Record<string, string> = {
  dashboard: 'linear-gradient(135deg,#14213D,#1B3358)',
  'grp-marketing': 'linear-gradient(135deg,#1FA463,#0B6E4F)',
  'grp-cases': 'linear-gradient(135deg,#2F80C4,#1B5C94)',
  grouptours: 'linear-gradient(135deg,#C9922E,#A6741B)',
  'grp-hr': 'linear-gradient(135deg,#8B5CF6,#6D3FD1)',
  'grp-finance': 'linear-gradient(135deg,#D14D72,#A32F52)',
};

export function ModuleHub({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2">
        {NAV_GROUPS.map(g => (
          <button key={g.id} onClick={() => onOpen(g.id)}
            className="text-left rounded-2xl p-6 text-white transition-transform hover:scale-[1.02]"
            style={{ background: HUB_COLORS[g.id] || 'var(--navy)', border: 'none', cursor: 'pointer', minHeight: 120 }}>
            <div className="font-display text-[19px] font-semibold mb-1.5">{g.label}</div>
            <div className="text-[12.5px]" style={{ opacity: 0.9 }}>{g.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
