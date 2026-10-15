'use client';
import { useMemo } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, DESTINATIONS, today } from '@/lib/constants';
import { shiftMonth, monthLabel } from '@/lib/finance';
import { moneyHome } from '@/lib/money';
import { useMoneyInput } from '@/components/shell/useMoney';
import { ModuleHero, StatCard, Panel, Ring, BarList, Sparkline } from '@/components/ui/Kit';
import { PerfDashCard } from './PerfWatch';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const STAGE_COLORS: Record<string, string> = { New: 'hsl(214 70% 52%)', Contacted: 'hsl(38 88% 50%)', Qualified: 'hsl(258 58% 56%)', Converted: 'hsl(152 62% 38%)', Lost: 'hsl(215 12% 62%)' };

export function Dashboard() {
  const { leads, cases, appointments, activity, transactions, revenueGoal, loans } = useAppData();
  const input = useMoneyInput();
  const todayStr = today();
  const now = new Date();
  const mh = useMemo(() => moneyHome(todayStr.slice(0, 7), input, todayStr), [input, todayStr]);

  const activeCases = cases.filter(c => c.status === 'Active').length;
  const upcoming = appointments.filter(a => a.date >= todayStr && a.status === 'Scheduled').length;
  const decided = cases.filter(c => c.status === 'Approved' || c.status === 'Refused').length;
  const approvalRate = decided ? Math.round((cases.filter(c => c.status === 'Approved').length / decided) * 100) : 0;
  const openLeads = leads.filter(l => !['Converted', 'Lost'].includes(l.stage)).length;
  const loansGiven = loans.filter(l => l.direction === 'Given' && l.status === 'Active').reduce((s, l) => s + Math.max(0, l.principal - l.amountRepaid), 0);
  const loansTaken = loans.filter(l => l.direction === 'Taken' && l.status === 'Active').reduce((s, l) => s + Math.max(0, l.principal - l.amountRepaid), 0);
  const netPosition = mh.bank + loansGiven - loansTaken;

  const yearStart = `${now.getFullYear()}-01-01`;
  const incomeThisYear = transactions.filter(t => t.type === 'Income' && t.date >= yearStart).reduce((s, t) => s + t.amount, 0);
  const goal = Number(revenueGoal) || 10000000;
  const goalPct = Math.min(100, Math.round((incomeThisYear / goal) * 100));
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const dayOfYear = Math.round((now.getTime() - startOfYear) / 86400000) + 1;
  const daysInYear = Math.round((endOfYear - startOfYear) / 86400000);
  const onTrack = incomeThisYear >= goal * (dayOfYear / daysInYear);
  const monthsLeft = Math.max(1, 12 - now.getMonth());
  const neededPerMonth = Math.max(0, (goal - incomeThisYear) / monthsLeft);

  const stages = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
  const stageRows = stages.map(s => ({ label: s, value: leads.filter(l => l.stage === s).length, color: STAGE_COLORS[s] }));
  const countryData = DESTINATIONS.map(d => ({ name: d, count: leads.filter(l => l.destination === d).length + cases.filter(c => c.destination === d).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);

  // Leads per month for the small trend line.
  const leadTrend = Array.from({ length: 6 }, (_, i) => { const m = shiftMonth(todayStr.slice(0, 7), i - 5); return leads.filter(l => (l.createdAt || '').slice(0, 7) === m).length; });

  return (
    <div>
      <div className="mb-5">
        <ModuleHero tab="dashboard" title="Business at a glance" subtitle="Leads, cases, money and your team — everything that matters, on one screen."
          stats={[
            { label: 'Received this month', value: money(mh.received) },
            { label: 'Clients still owe', value: money(mh.stillOwed) },
            { label: 'Net position', value: money(netPosition) },
          ]} />
      </div>

      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <div className="relative"><StatCard label="Open leads" icon="leads" color="hsl(14 74% 48%)" value={openLeads} hint={`${leads.length} leads in total`} />
          <div className="absolute right-4 top-4"><Sparkline values={leadTrend} color="hsl(14 74% 48%)" width={86} height={28} /></div></div>
        <StatCard label="Active cases" icon="cases" color="hsl(221 70% 48%)" value={activeCases} hint={`${cases.length} files in total · ${approvalRate}% approved`} />
        <div className="relative"><StatCard label="What we kept" icon="profit" color={mh.kept >= 0 ? 'hsl(128 58% 32%)' : 'hsl(4 66% 46%)'} value={`${mh.kept < 0 ? '− ' : ''}${money(Math.abs(mh.kept))}`} hint={`${monthLabel(mh.month)} · received minus spent`} />
          <div className="absolute right-4 top-4"><Sparkline values={mh.trend.map(p => p.net)} color="hsl(128 58% 32%)" width={86} height={28} /></div></div>
        <StatCard label="Appointments ahead" icon="appointments" color="hsl(196 72% 40%)" value={upcoming} hint="Scheduled, not yet completed" />
      </div>

      <div className="grid grid-cols-[1.35fr_1fr] gap-4 mt-4 max-lg:grid-cols-1">
        <Panel title="Lead pipeline" subtitle="Where every lead is right now">
          <BarList rows={stageRows} />
        </Panel>
        <Panel title="Yearly goal" subtitle={`${now.getFullYear()} · target ${money(goal)}`}>
          <div className="flex items-center gap-5 flex-wrap">
            <Ring pct={goalPct} size={112} stroke={12} color={onTrack ? 'hsl(152 62% 36%)' : 'hsl(32 90% 48%)'} />
            <div className="min-w-0 flex-1" style={{ minWidth: 190 }}>
              <div className="font-display text-[24px] font-semibold">{money(incomeThisYear)}</div>
              <div className="text-[12.5px] text-[var(--muted)]">received so far this year</div>
              <div className="text-[13px] mt-2 font-semibold" style={{ color: onTrack ? 'hsl(152 62% 30%)' : 'hsl(32 88% 36%)' }}>
                {onTrack ? 'On pace to hit the goal.' : 'Behind the pace for this point in the year.'}
              </div>
              <div className="text-[12.5px] text-[var(--muted)] mt-1">Needs about {money(neededPerMonth)} a month for the rest of the year.</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-[1.35fr_1fr] gap-4 mt-4 max-lg:grid-cols-1">
        <Panel title="Business by country" subtitle="Leads and cases together, top destinations">
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryData} layout="vertical" margin={{ left: 12, right: 18 }}>
                <CartesianGrid stroke="var(--accent-line)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11.5 }} />
                <Tooltip cursor={{ fill: 'var(--accent-soft)' }} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                  {countryData.map((_, i) => <Cell key={i} fill={`hsl(${224 - i * 9} 62% ${44 + i * 2}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Recent activity" subtitle="What the team did lately" flush>
          <div style={{ maxHeight: 290, overflow: 'auto' }}>
            {activity.length ? activity.slice(0, 14).map((a, i) => (
              <div key={i} className="flex gap-3 px-5 py-2.5 text-[13px]" style={{ borderBottom: '1px solid var(--accent-line)' }}>
                <span className="w-2 h-2 rounded-full mt-1.5 flex-none" style={{ background: 'var(--accent-2)', boxShadow: '0 0 0 4px var(--accent-soft-2)' }} />
                <span>{a.t}</span>
              </div>
            )) : <div className="text-[var(--muted)] p-5">No activity yet.</div>}
          </div>
        </Panel>
      </div>

      <div className="mt-4"><PerfDashCard /></div>
    </div>
  );
}
