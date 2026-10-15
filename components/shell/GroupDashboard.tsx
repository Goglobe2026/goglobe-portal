'use client';
import { useAppData } from '@/lib/AppDataContext';
import type { NavGroup } from '@/lib/navGroups';
import { themeVars } from '@/lib/moduleTheme';
import { Icon } from '@/components/ui/icons';
import { StatCard, Callout } from '@/components/ui/Kit';
import { money } from '@/lib/constants';
import { useGroupStats } from './groupStats';
import { useMoneyInput } from './useMoney';
import { moneyHome } from '@/lib/money';
import { today } from '@/lib/constants';
import { useMemo } from 'react';

export { TILE_ICONS, DEFAULT_ICON } from '@/components/ui/icons';

const FLOW: Record<string, string> = {
  money: 'See',
  billing: 'Collect',
  payouts: 'Pay',
  profit: 'Review',
  closing: 'Lock',
  accounts: 'Record',
};

export function GroupDashboard({ group, onOpenTile, onBack }: { group: NavGroup; onOpenTile: (id: string) => void; onBack: () => void }) {
  const stats = useGroupStats(group.id);
  const { leads } = useAppData();
  const input = useMoneyInput();
  const mh = useMemo(() => (group.id === 'grp-finance' ? moneyHome(today().slice(0, 7), input, today()) : null), [group.id, input]);

  if (group.standalone) return null; // shouldn't render for standalone groups

  const sourceBreakdown = group.id === 'grp-marketing' ? (() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.source || 'Unknown'] = (counts[l.source || 'Unknown'] || 0) + 1; });
    const total = leads.length || 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }));
  })() : null;

  const toneColor = { good: 'hsl(152 62% 34%)', bad: 'hsl(4 66% 46%)', warn: 'hsl(32 88% 42%)' } as const;

  return (
    <div>
      <button className="btn btn-sm mb-4" onClick={onBack}>← Back to all modules</button>

      {group.id === 'grp-finance' && mh ? (
        <>
          <div className="grid gap-3.5 mb-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatCard label="Received" icon="money" color="hsl(152 62% 34%)" value={money(mh.received)} hint="Cash that reached the account this month" testid="fin-received" />
            <StatCard label="Spent" icon="payouts" color="hsl(352 62% 46%)" value={money(mh.spent)} hint="Cash that left the account this month" testid="fin-spent" />
            <StatCard label="What we kept" icon="profit" color={mh.kept >= 0 ? 'hsl(128 58% 32%)' : 'hsl(4 66% 46%)'} value={`${mh.kept < 0 ? '− ' : ''}${money(Math.abs(mh.kept))}`} hint="Received minus spent" testid="fin-kept" />
            <StatCard label="Clients still owe" icon="billing" color="hsl(28 88% 44%)" value={money(mh.stillOwed)} hint="Not counted above until they pay" testid="fin-owed" />
          </div>
          <Callout tone="info" title="How to read Finance in one line">
            Money <b>comes in</b> when a client pays, <b>goes out</b> when we pay someone, and <b>what we kept</b> is the difference. Whatever a client has not paid yet is only <b>owed</b> — it is never counted as ours until it arrives. Follow the six steps below, left to right.
          </Callout>
          <div className="h-5" />
        </>
      ) : stats.length > 0 && (
        <div className="grid gap-3.5 mb-5 max-md:grid-cols-2" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map(s => (
            <StatCard key={s.label} label={s.label} value={s.value} color={s.tone ? toneColor[s.tone] : undefined} />
          ))}
        </div>
      )}

      {sourceBreakdown && sourceBreakdown.length > 0 && (
        <div className="panel mb-5">
          <div className="panel-head"><div><h3>Where your leads come from</h3><p>Share of all leads by source</p></div></div>
          <div className="panel-body flex flex-col gap-2.5">
            {sourceBreakdown.map(s => (
              <div key={s.source} className="flex items-center gap-3">
                <div className="w-28 flex-none text-[13px] font-semibold truncate">{s.source}</div>
                <div className="flex-1 rounded-full h-3 overflow-hidden" style={{ background: 'var(--accent-soft-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
                </div>
                <div className="w-20 text-right text-[12.5px] text-[var(--muted)] font-mono-ui">{s.count} · {s.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
        {group.tiles.map((tile, i) => {
          return (
            <button key={tile.id} onClick={() => onOpenTile(tile.id)} data-testid={`tile-${tile.id}`}
              className="relative text-left rounded-[20px] p-5 bg-white transition-all hover:-translate-y-1 rise overflow-hidden flex flex-col justify-start items-stretch"
              style={{ ...(themeVars(tile.id) as React.CSSProperties), border: '1px solid #E3E9F2', boxShadow: '0 1px 2px rgba(20,33,61,.04), 0 12px 26px -20px rgba(20,33,61,.3)', cursor: 'pointer', animationDelay: `${i * 35}ms` }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 22px 40px -22px var(--accent-glow)'; e.currentTarget.style.borderColor = 'var(--accent-line)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(20,33,61,.04), 0 12px 26px -20px rgba(20,33,61,.3)'; e.currentTarget.style.borderColor = '#E3E9F2'; }}
            >
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, var(--accent-2), var(--accent))', boxShadow: '0 10px 20px -12px var(--accent-glow)' }}>
                <Icon id={tile.id} size={21} stroke="#fff" width={1.7} />
              </div>
              <div className="font-display text-[17px] font-semibold mb-1.5" style={{ color: 'var(--accent-ink)' }}>{tile.label}</div>
              <div className="text-[12.5px] leading-relaxed text-[var(--muted)]">{tile.blurb}</div>
              {group.id === 'grp-finance' && (
                <span className="absolute top-4 right-4 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: 'var(--accent-soft-2)', color: 'var(--accent-ink)' }}>{i + 1} · {FLOW[tile.id]}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
