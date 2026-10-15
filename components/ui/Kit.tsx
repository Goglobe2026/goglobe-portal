'use client';
import { ReactNode, CSSProperties } from 'react';
import { Icon } from './icons';
import { themeOf, patternImage } from '@/lib/moduleTheme';

// ---------------------------------------------------------------------------
// Small building blocks used by every redesigned screen.
// ---------------------------------------------------------------------------

export function ModuleHero({
  tab, title, subtitle, stats, actions, iconId, compact,
}: {
  tab: string; title: string; subtitle?: string;
  stats?: { label: string; value: string }[]; actions?: ReactNode; iconId?: string; compact?: boolean;
}) {
  const t = themeOf(tab);
  const style = { '--hero-pattern': patternImage(t.pattern) } as CSSProperties;
  return (
    <div className="hero rise" style={{ ...style, padding: compact ? '18px 24px' : undefined }} data-testid="module-hero">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="hero-icon"><Icon id={iconId || tab} size={26} stroke="#fff" width={1.7} /></div>
        <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
          <div className="text-[11.5px] font-bold uppercase tracking-[.12em]" style={{ opacity: .78 }}>{t.group}</div>
          <h1 className="font-display m-0 text-[26px] font-semibold leading-tight max-md:text-[22px]">{title}</h1>
          {subtitle && <div className="text-[13.5px] mt-1 max-w-[760px]" style={{ opacity: .9, lineHeight: 1.5 }}>{subtitle}</div>}
        </div>
        {actions && <div className="flex gap-2 flex-wrap items-center">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="flex gap-2.5 flex-wrap mt-4">
          {stats.map(s => (
            <div className="hero-chip" key={s.label}><b>{s.value}</b><span>{s.label}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label, value, hint, color, icon, testid,
}: { label: string; value: ReactNode; hint?: ReactNode; color?: string; icon?: string; testid?: string }) {
  return (
    <div className="stat" style={color ? ({ '--stat': color } as CSSProperties) : undefined} data-testid={testid}>
      <div className="stat-label">
        {icon && <span className="stat-icon"><Icon id={icon} size={16} /></span>}
        {label}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Panel({
  title, subtitle, action, children, flush, testid, style,
}: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; testid?: string; style?: CSSProperties }) {
  return (
    <section className="panel rise-2" data-testid={testid} style={style}>
      {(title || action) && (
        <div className="panel-head">
          <div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>
          {action}
        </div>
      )}
      <div className={flush ? '' : 'panel-body'}>{children}</div>
    </section>
  );
}

export function PillTabs<T extends string>({
  items, value, onChange, numbered,
}: { items: { id: T; label: string; badge?: string }[]; value: T; onChange: (id: T) => void; numbered?: boolean }) {
  return (
    <div className="pilltabs" role="tablist">
      {items.map((it, i) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={`pilltab ${value === it.id ? 'on' : ''}`} onClick={() => onChange(it.id)} data-testid={`pill-${it.id}`}>
          {numbered && <span className="num">{i + 1}</span>}
          {it.label}
          {it.badge && <span className="text-[11px] font-bold px-1.5 rounded-full" style={{ background: 'var(--red)', color: '#fff' }}>{it.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// A ring that fills to a percentage.
export function Ring({ pct, size = 96, stroke = 10, color = 'var(--accent)', label }: { pct: number; size?: number; stroke?: number; color?: string; label?: ReactNode }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const p = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-soft-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        {label ?? <b className="font-display" style={{ fontSize: size / 4.2 }}>{Math.round(p)}%</b>}
      </div>
    </div>
  );
}

// A row of horizontal bars (label, bar, value).
export function BarList({ rows, color = 'var(--accent)', valueFmt }: { rows: { label: string; value: number; note?: string; color?: string }[]; color?: string; valueFmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex justify-between text-[12.5px] mb-1 gap-3">
            <span className="font-semibold truncate">{r.label}{r.note && <span className="font-normal text-[var(--muted)]"> · {r.note}</span>}</span>
            <span className="font-mono-ui flex-none">{valueFmt ? valueFmt(r.value) : r.value}</span>
          </div>
          <div className="rounded-full h-2.5 overflow-hidden" style={{ background: 'var(--accent-soft-2)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color || color, transition: 'width .5s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'good' | 'warn' | 'bad'; title?: ReactNode; children: ReactNode }) {
  const map = {
    info: ['#1D5FA8', '#EAF2FC'], good: ['#0B6E4F', '#E6F6EE'], warn: ['#9A6212', '#FCF3DF'], bad: ['#B5433A', '#FCECE9'],
  } as const;
  const [c, bg] = map[tone];
  return (
    <div className="rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed" style={{ background: bg, color: '#1d2a44', borderLeft: `4px solid ${c}` }}>
      {title && <div className="font-bold mb-0.5" style={{ color: c }}>{title}</div>}
      {children}
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 34, color = 'var(--accent)' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values); const min = Math.min(...values); const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 3 - ((v - min) / span) * (height - 6)}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
