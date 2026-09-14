'use client';
import { useAppData } from '@/lib/AppDataContext';
import { money, today } from '@/lib/constants';
import type { NavGroup } from '@/lib/navGroups';

const TILE_COLORS = [
  'linear-gradient(135deg,#1FA463,#0B6E4F)',
  'linear-gradient(135deg,#2F80C4,#1B5C94)',
  'linear-gradient(135deg,#C9922E,#A6741B)',
  'linear-gradient(135deg,#8B5CF6,#6D3FD1)',
];

function useGroupStats(groupId: string) {
  const { leads, cases, appointments, team, requests, transactions, bankAccounts, loans } = useAppData();
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
    ];
  }
  if (groupId === 'grp-finance') {
    const totalBank = bankAccounts.reduce((s, b) => s + b.balance, 0);
    const thisMonth = todayStr.slice(0, 7);
    const income = transactions.filter(t => t.type === 'Income' && t.date.slice(0, 7) === thisMonth).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === thisMonth).reduce((s, t) => s + t.amount, 0);
    return [
      { label: 'Bank + cash balance', value: money(totalBank) },
      { label: 'Cash flow this month', value: money(income - expense) },
    ];
  }
  return [];
}

export function GroupDashboard({ group, onOpenTile, onBack }: { group: NavGroup; onOpenTile: (id: string) => void; onBack: () => void }) {
  const stats = useGroupStats(group.id);

  if (group.standalone) return null; // shouldn't render for standalone groups

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

      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        {group.tiles.map((tile, i) => (
          <button key={tile.id} onClick={() => onOpenTile(tile.id)}
            className="text-left rounded-2xl p-5 text-white transition-transform hover:scale-[1.02]"
            style={{ background: TILE_COLORS[i % TILE_COLORS.length], border: 'none', cursor: 'pointer' }}>
            <div className="font-display text-[17px] font-semibold mb-1.5">{tile.label}</div>
            <div className="text-[12.5px]" style={{ opacity: 0.9 }}>{tile.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
