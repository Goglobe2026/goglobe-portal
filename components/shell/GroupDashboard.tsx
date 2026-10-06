'use client';
import { useAppData } from '@/lib/AppDataContext';
import { money, today } from '@/lib/constants';
import type { NavGroup } from '@/lib/navGroups';
import type { ReactElement } from 'react';

// Same gold-on-navy icon treatment as the top-level hub, so every level of
// navigation feels like one system rather than a different theme each time
// you go one level deeper.
const TILE_ICONS: Record<string, ReactElement> = {
  leads: <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8" strokeLinecap="round" strokeLinejoin="round" />,
  campaigns: <path d="M11 19l-2-9 9-4-4 9-9 2 6 2z M4 4l2 2M4 13h2M13 4v2" strokeLinecap="round" strokeLinejoin="round" />,
  testimonials: <path d="M7 15h2l2-4V7H5v4h3l-1 4zm8 0h2l2-4V7h-6v4h3l-1 4z" strokeLinecap="round" strokeLinejoin="round" />,
  cases: <path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />,
  appointments: <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM8 13h2M14 13h2M8 17h2" strokeLinecap="round" strokeLinejoin="round" />,
  referralagents: <path d="M18 8a3 3 0 11-6 0 3 3 0 016 0zM6 8a3 3 0 106 0M2 19c0-2.8 2-5 5-5M13 19c0-2.5 1.8-4.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />,
  hr: <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.5-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M16 20c0-2.5-1.5-4-3.5-4.5" strokeLinecap="round" strokeLinejoin="round" />,
  attendance: <path d="M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" strokeLinecap="round" strokeLinejoin="round" />,
  accounts: <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M7 15h4" strokeLinecap="round" strokeLinejoin="round" />,
  reports: <path d="M4 19V11M11 19V5M18 19V13" strokeLinecap="round" strokeLinejoin="round" />,
  billing: <path d="M7 3h10a1 1 0 011 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 011-1zM9 8h6M9 12h6" strokeLinecap="round" strokeLinejoin="round" />,
  complaints: <path d="M12 4l9 16H3L12 4zM12 10v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />,
  clientdocs: <path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" strokeLinejoin="round" />,
  appraisal: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z" strokeLinecap="round" strokeLinejoin="round" />,
  announcements: <path d="M4 10v4h3l6 4V6L7 10H4zM16 9a4 4 0 010 6" strokeLinecap="round" strokeLinejoin="round" />,
  letters: <path d="M4 6h16v12H4V6zM4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />,
  payroll: <path d="M12 3v18M16.5 7.5C16.5 6 14.5 5 12 5S7.5 6.2 7.5 8s1.8 2.4 4.5 3 4.5 1.3 4.5 3.2S14.5 18 12 18s-4.5-1-4.5-2.5" strokeLinecap="round" strokeLinejoin="round" />,
  closing: <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  pricing: <path d="M9 5H5a1 1 0 00-1 1v4l9 9 5-5-9-9zM7 8h.01" strokeLinecap="round" strokeLinejoin="round" />,
};
const DEFAULT_ICON = <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" strokeLinejoin="round" />;

function useGroupStats(groupId: string) {
  const { leads, cases, appointments, team, requests, transactions, bankAccounts, loans, monthlyClosings, payRuns } = useAppData();
  const todayStr = today();

  if (groupId === 'grp-marketing') {
    const overdue = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= todayStr && !['Converted', 'Lost'].includes(l.stage)).length;
    const tagged = leads.flatMap(l => l.messages).filter(m => m.direction === 'Out' && (m.responded === 'Yes' || m.responded === 'No'));
    const responded = tagged.filter(m => m.responded === 'Yes').length;
    const responseRate = tagged.length > 0 ? `${Math.round((responded / tagged.length) * 100)}%` : '—';
    return [
      { label: 'Total leads', value: String(leads.length) },
      { label: 'New today', value: String(leads.filter(l => l.createdAt === todayStr).length) },
      { label: 'Follow-ups due', value: String(overdue) },
      { label: 'Response rate', value: responseRate },
    ];
  }
  if (groupId === 'grp-cases') {
    return [
      { label: 'Active cases', value: String(cases.filter(c => c.status === 'Active').length) },
      { label: 'Awaiting review', value: String(cases.filter(c => c.caseStage === 'Manager Review').length) },
      { label: 'Appointments ahead', value: String(appointments.filter(a => a.date >= todayStr).length) },
      { label: 'Total cases', value: String(cases.length) },
    ];
  }
  if (groupId === 'grp-hr') {
    return [
      { label: 'Total staff', value: String(team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active').length) },
      { label: 'Pending requests', value: String(requests.filter(r => r.status === 'Pending').length) },
      (() => {
        const [y, m] = todayStr.slice(0, 7).split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const r = payRuns.find(x => x.month === key);
        return { label: `${d.toLocaleDateString('en-GB', { month: 'long' })} payroll`, value: r ? r.status : 'Not started' };
      })(),
    ];
  }
  if (groupId === 'grp-finance') {
    const totalBank = bankAccounts.reduce((s, b) => s + b.balance, 0);
    const thisMonth = todayStr.slice(0, 7);
    const income = transactions.filter(t => t.type === 'Income' && t.date.slice(0, 7) === thisMonth).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === thisMonth).reduce((s, t) => s + t.amount, 0);
    const pending = cases.reduce((s, c) => s + Math.max(0, c.fee + c.apptFee + c.consultFee - c.discount - (c.paid + c.apptPaid + c.consultPaid)), 0);
    const [py, pm] = thisMonth.split('-').map(Number);
    const pd = new Date(py, pm - 2, 1);
    const prevKey = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
    const prevName = pd.toLocaleDateString('en-GB', { month: 'long' });
    const closed = monthlyClosings.some(c => c.month === prevKey);
    const hadActivity = transactions.some(t => t.date.slice(0, 7) === prevKey);
    return [
      { label: 'Bank + cash balance', value: money(totalBank) },
      { label: 'Cash flow this month', value: money(income - expense) },
      { label: 'Pending collections', value: money(pending) },
      { label: `${prevName} closing`, value: closed ? 'Closed' : hadActivity ? 'Due by the 5th' : 'No activity' },
    ];
  }
  return [];
}

export function GroupDashboard({ group, onOpenTile, onBack }: { group: NavGroup; onOpenTile: (id: string) => void; onBack: () => void }) {
  const stats = useGroupStats(group.id);
  const { leads } = useAppData();

  if (group.standalone) return null; // shouldn't render for standalone groups

  const sourceBreakdown = group.id === 'grp-marketing' ? (() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.source || 'Unknown'] = (counts[l.source || 'Unknown'] || 0) + 1; });
    const total = leads.length || 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }));
  })() : null;

  return (
    <div>
      <button className="btn btn-sm mb-4" onClick={onBack}>← Back to all modules</button>

      {stats.length > 0 && (
        <div className={`grid gap-3.5 mb-5 max-md:grid-cols-2`} style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map(s => (
            <div key={s.label} className="card">
              <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{s.label}</div>
              <div className="font-display text-[22px] font-semibold mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {group.id === 'grp-finance' && (
        <div className="card mb-5" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#14213D' }}>How money moves in GoGlobe — and where to record it</div>
          <div style={{ fontSize: 14.5, color: '#5B6270', margin: '4px 0 14px' }}>Revenue is the cash actually received in a month. A balance a client pays later counts in the month it is paid.</div>
          <div className="grid gap-4 max-md:grid-cols-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              ['1', 'Money in', 'A client pays: open the Case → Record a payment (or Invoice → Mark advance / balance paid). Whatever they still owe stays on the case as pending.'],
              ['2', 'Money out', 'Salaries: HR → Payroll → run the month and pay. Rent, ads and bills: Accounts → add an expense. Salary advances: Payroll → Advances.'],
              ['3', 'Month end (by the 5th)', 'Finance → Monthly Closing shows last month’s cash in and out, the balance carried forward, and every client balance still to collect. Close the month to lock it.'],
            ].map(([n, t, d]) => (
              <div key={n} style={{ borderLeft: '4px solid #C9922E', paddingLeft: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#14213D' }}>{n}. {t}</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#333', marginTop: 4 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sourceBreakdown && sourceBreakdown.length > 0 && (
        <div className="card mb-5">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-3">Where your leads come from</div>
          <div className="flex flex-col gap-2.5">
            {sourceBreakdown.map(s => (
              <div key={s.source} className="flex items-center gap-3">
                <div className="w-24 flex-none text-[13px] font-medium">{s.source}</div>
                <div className="flex-1 rounded-md h-5 overflow-hidden" style={{ background: 'var(--gold-50)' }}>
                  <div className="h-full rounded-md" style={{ width: `${s.pct}%`, background: 'linear-gradient(90deg,#1B3358,#14213D)' }} />
                </div>
                <div className="w-16 text-right text-[12.5px] text-[var(--muted)] font-mono-ui">{s.count} · {s.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        {group.tiles.map(tile => (
          <button key={tile.id} onClick={() => onOpenTile(tile.id)}
            className="text-left rounded-2xl p-6 bg-white transition-all hover:-translate-y-0.5"
            style={{ border: '1px solid var(--line)', boxShadow: '0 1px 2px rgba(20,33,61,.04)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 28px rgba(20,33,61,.09)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(20,33,61,.04)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
          >
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4" style={{ background: 'var(--gold-50)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14213D" strokeWidth="1.7">
                {TILE_ICONS[tile.id] || DEFAULT_ICON}
              </svg>
            </div>
            <div className="font-display text-[16.5px] font-semibold mb-1.5" style={{ color: '#14213D' }}>{tile.label}</div>
            <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>{tile.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
