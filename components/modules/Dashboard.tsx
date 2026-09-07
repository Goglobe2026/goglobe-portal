'use client';
import { useAppData } from '@/lib/AppDataContext';
import { money, DESTINATIONS } from '@/lib/constants';
import { SectionHead } from '@/components/ui/Primitives';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

export function Dashboard() {
  const { leads, cases, appointments, activity, transactions, revenueGoal, bankAccounts, loans } = useAppData();
  const today = new Date().toISOString().slice(0, 10);

  const totalLeads = leads.length;
  const activeCases = cases.filter(c => c.status === 'Active').length;
  const overallCharge = (c: typeof cases[0]) => Math.max(0, c.fee + c.apptFee + c.consultFee - c.discount);
  const overallPaid = (c: typeof cases[0]) => c.paid + c.apptPaid + c.consultPaid;
  const revenueCollected = cases.reduce((s, c) => s + overallPaid(c), 0);
  const revenuePending = cases.reduce((s, c) => s + (overallCharge(c) - overallPaid(c)), 0);
  const upcoming = appointments.filter(a => a.date >= today && a.status === 'Scheduled').length;
  const decided = cases.filter(c => c.status === 'Approved' || c.status === 'Refused').length;
  const totalBank = bankAccounts.reduce((s, b) => s + b.balance, 0);
  const loansGivenOutstanding = loans.filter(l => l.direction === 'Given' && l.status === 'Active').reduce((s, l) => s + Math.max(0, l.principal - l.amountRepaid), 0);
  const loansTakenOutstanding = loans.filter(l => l.direction === 'Taken' && l.status === 'Active').reduce((s, l) => s + Math.max(0, l.principal - l.amountRepaid), 0);
  const netPosition = totalBank + loansGivenOutstanding - loansTakenOutstanding;
  const approvalRate = decided ? Math.round((cases.filter(c => c.status === 'Approved').length / decided) * 100) : 0;

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const incomeThisYear = transactions.filter(t => t.type === 'Income' && t.date >= yearStart).reduce((s, t) => s + t.amount, 0);
  const goal = Number(revenueGoal) || 10000000;
  const goalPct = Math.min(100, Math.round((incomeThisYear / goal) * 100));
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const dayOfYear = Math.round((now.getTime() - startOfYear) / 86400000) + 1;
  const daysInYear = Math.round((endOfYear - startOfYear) / 86400000);
  const expectedPace = goal * (dayOfYear / daysInYear);
  const onTrack = incomeThisYear >= expectedPace;
  const monthsLeft = Math.max(1, 12 - now.getMonth());
  const neededPerMonth = Math.max(0, (goal - incomeThisYear) / monthsLeft);

  const stages = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];
  const maxCount = Math.max(1, ...stages.map(s => leads.filter(l => l.stage === s).length));

  const countryData = DESTINATIONS.map(d => ({
    name: d,
    count: leads.filter(l => l.destination === d).length + cases.filter(c => c.destination === d).length,
  }));

  return (
    <div>
      <div className="card mb-3.5" style={{ background: 'linear-gradient(135deg,#14213D,#1B3358)', border: 'none', color: '#fff' }}>
        <div className="text-[11.5px] uppercase tracking-wide font-semibold" style={{ opacity: 0.75 }}>Net position right now</div>
        <div className="font-display text-[28px] font-semibold mt-1.5">{money(netPosition)}</div>
        <div className="text-[11.5px] mt-1.5" style={{ opacity: 0.85 }}>Company accounts, plus what's owed to you, minus what you owe — full breakdown in Reports &amp; Finance</div>
      </div>
      <div className="grid grid-cols-5 gap-3.5 max-lg:grid-cols-3 max-md:grid-cols-2">
        <Metric label="Open leads" value={String(totalLeads)} note="In the pipeline right now" />
        <Metric label="Active cases" value={String(activeCases)} note={`${cases.length} total on file`} />
        <Metric label="Revenue collected" value={money(revenueCollected)} note={`${money(revenuePending)} pending`} />
        <Metric label="Appointments ahead" value={String(upcoming)} note="Scheduled, not yet completed" />
        <Metric label="Approval rate" value={`${approvalRate}%`} note={`Across ${decided} decided cases`} />
      </div>

      <SectionHead title="Annual revenue goal" count={`${now.getFullYear()} — ${money(goal)} target`} />
      <div className="card">
        <div className="flex justify-between items-baseline mb-2">
          <span className="font-display text-2xl font-semibold">{money(incomeThisYear)}</span>
          <span className="text-[var(--muted)] text-sm">of {money(goal)} ({goalPct}%)</span>
        </div>
        <div className="rounded-md h-3 overflow-hidden mb-3" style={{ background: 'var(--navy-50)' }}>
          <div className="h-full rounded-md" style={{ width: `${goalPct}%`, background: onTrack ? 'linear-gradient(90deg,var(--navy),var(--navy-light))' : 'linear-gradient(90deg,var(--gold),#e0ac3f)' }} />
        </div>
        <div className="text-[12.5px]" style={{ color: onTrack ? 'var(--green)' : 'var(--gold)' }}>
          {onTrack ? 'On pace to hit your goal.' : 'Behind pace for this point in the year.'} To reach {money(goal)} by year end, you need about {money(neededPerMonth)}/month for the rest of {now.getFullYear()}.
        </div>
      </div>

      <SectionHead title="Business by country" count="leads + cases, every destination you deal in" />
      <div className="card" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={countryData}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="var(--navy-light)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-3.5 mt-4 max-md:grid-cols-1">
        <div className="card">
          <SectionHead title="Lead pipeline" count="by stage" />
          <div className="flex flex-col gap-2">
            {stages.map(s => {
              const n = leads.filter(l => l.stage === s).length;
              return (
                <div key={s} className="flex items-center gap-2.5 text-[12.5px]">
                  <div className="w-[92px] flex-none text-[var(--muted)] font-medium">{s}</div>
                  <div className="flex-1 rounded-md h-5 overflow-hidden" style={{ background: 'var(--navy-50)' }}>
                    <div className="h-full rounded-md" style={{ width: `${(n / maxCount) * 100}%`, background: 'linear-gradient(90deg,var(--navy),var(--navy-light))' }} />
                  </div>
                  <div className="w-6 text-right font-mono-ui font-semibold">{n}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <SectionHead title="Recent activity" />
          {activity.length ? activity.map((a, i) => (
            <div key={i} className="flex gap-2.5 py-2 text-[12.5px] border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-none" style={{ background: 'var(--gold)' }} />
              <span>{a.t}</span>
            </div>
          )) : <div className="text-[var(--muted)] py-4">No activity yet.</div>}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card">
      <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[26px] font-semibold mt-1.5">{value}</div>
      <div className="text-[11.5px] text-[var(--faint)] mt-1">{note}</div>
    </div>
  );
}
