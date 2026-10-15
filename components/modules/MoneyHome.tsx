'use client';
import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { money, fmtDate, today } from '@/lib/constants';
import { monthLabel, shiftMonth } from '@/lib/finance';
import { moneyHome } from '@/lib/money';
import { useMoneyInput } from '@/components/shell/useMoney';
import { Panel, BarList, Callout } from '@/components/ui/Kit';
import { Icon } from '@/components/ui/icons';

// The Finance overview. One idea per card, plain words, and the one thing that
// confuses everyone — money that is OWED — kept visibly apart from money that
// has ARRIVED.

const GREEN = 'hsl(152 62% 32%)';
const RED = 'hsl(352 62% 44%)';
const AMBER = 'hsl(28 88% 42%)';
const BLUE = 'hsl(214 70% 44%)';

const pctDelta = (cur: number, base: number | undefined) => {
  if (base === undefined || base === 0) return null;
  return Math.round(((cur - base) / Math.abs(base)) * 100);
};

function Big({ tone, label, value, line, delta, goodUp = true, testid, dashed }: {
  tone: string; label: string; value: string; line: string; delta?: number | null; goodUp?: boolean; testid: string; dashed?: boolean;
}) {
  const good = delta === null || delta === undefined ? null : (delta >= 0) === goodUp;
  return (
    <div className="flex-1 min-w-[190px] rounded-[22px] bg-white p-5 rise"
      style={{ border: dashed ? `2px dashed ${tone}` : '1px solid var(--accent-line)', boxShadow: dashed ? 'none' : `0 20px 36px -26px ${tone}`, background: dashed ? `color-mix(in srgb, ${tone} 5%, white)` : '#fff' }} data-testid={testid}>
      <div className="text-[11.5px] font-bold uppercase tracking-[.1em]" style={{ color: tone }}>{label}</div>
      <div className="font-display text-[31px] font-semibold leading-tight mt-1.5 whitespace-nowrap" style={{ color: tone }} data-testid={`${testid}-value`}>{value}</div>
      <div className="text-[12.5px] leading-snug text-[var(--muted)] mt-1.5">{line}</div>
      {delta !== null && delta !== undefined && (
        <div className="text-[11.5px] font-bold mt-2" style={{ color: good ? GREEN : RED }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last month</div>
      )}
    </div>
  );
}
const Op = ({ children }: { children: string }) => (
  <div className="flex-none self-center font-display text-[30px] font-semibold text-[var(--accent)] max-md:hidden" aria-hidden>{children}</div>
);

const GLOSSARY: [string, string][] = [
  ['Received', 'Money that actually arrived — a client payment or any other income. A payment counts in the month it arrives, not the month the file was opened.'],
  ['Spent', 'Money that actually left — salaries, commissions, ads, rent, bills, and embassy fees paid for clients.'],
  ['What we kept', 'Received minus spent. If it is below zero, more went out than came in this month.'],
  ['Clients still owe', 'The unpaid part of the fees we have charged. It is NOT money we have — it only turns into “received” on the day the client pays.'],
  ['Opened this month', 'The total value of files opened in the month. It shows how much business was sold, not how much cash arrived.'],
  ['Embassy & appointment fees', 'Money we pay the embassy on a client’s behalf. It is a cost to us, and it is collected from the client, so it is shown on its own.'],
  ['Month-end', 'Locking a finished month so its numbers cannot change, and carrying the closing balance into the next month.'],
];

export function MoneyHome({ go }: { go: (tab: string) => void }) {
  const input = useMoneyInput();
  const todayStr = today();
  const current = todayStr.slice(0, 7);
  const [month, setMonth] = useState(current);
  const [showWords, setShowWords] = useState(false);
  const m = useMemo(() => moneyHome(month, input, todayStr), [month, input, todayStr]);
  const spentTotal = m.spent || 1;

  const chart = m.trend.map(p => ({ label: monthLabel(p.month).split(' ')[0].slice(0, 3), Received: p.moneyIn, Spent: p.moneyOut }));

  return (
    <div data-testid="money-home">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 no-print">
        <div className="flex items-center gap-2">
          <button className="btn" data-testid="mh-earlier" onClick={() => setMonth(shiftMonth(month, -1))}>‹ Earlier</button>
          <div className="font-display text-[22px] font-semibold text-center" style={{ minWidth: 190, color: 'var(--accent-ink)' }} data-testid="mh-month">{m.label}</div>
          <button className="btn" data-testid="mh-later" disabled={month >= current} onClick={() => setMonth(shiftMonth(month, 1))}>Later ›</button>
          {month !== current && <button className="btn btn-sm btn-ghost" onClick={() => setMonth(current)}>This month</button>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip" title="Balances typed in under Books & Banks — not a live bank feed"><Icon id="accounts" size={14} />In bank &amp; cash: {money(m.bank)}</span>
          <span className="chip" style={{ background: m.running ? '#FCF1DC' : m.closed ? '#E4F5EC' : 'var(--accent-soft-2)', color: m.running ? '#9A6212' : m.closed ? '#0B6E4F' : 'var(--accent-ink)' }}>{m.running ? 'Month still running' : m.closed ? 'Month closed' : 'Month finished, not closed yet'}</span>
        </div>
      </div>

      {/* The one picture: received − spent = kept, and the money that is only OWED, kept apart */}
      <div className="flex gap-3.5 flex-wrap items-stretch">
        <Big testid="mh-received" tone={GREEN} label="Received" value={money(m.received)} line={`Cash that reached the account${m.receivedOther > 0 ? ` (${money(m.receivedClients)} from clients, ${money(m.receivedOther)} other)` : ' from clients'}.`} delta={m.running ? null : pctDelta(m.received, m.prev?.received)} />
        <Op>−</Op>
        <Big testid="mh-spent" tone={RED} label="Spent" value={money(m.spent)} line="Cash that left the account: pay, fees, ads, bills." delta={m.running ? null : pctDelta(m.spent, m.prev?.spent)} goodUp={false} />
        <Op>=</Op>
        <Big testid="mh-kept" tone={m.kept >= 0 ? 'hsl(128 56% 30%)' : RED} label="What we kept" value={`${m.kept < 0 ? '− ' : ''}${money(Math.abs(m.kept))}`} line={m.keptShare === null ? 'Nothing earned yet this month.' : m.kept >= 0 ? `${Math.round(m.keptShare * 100)}% of what the business earned was kept.` : 'More went out than came in.'} delta={m.prev && !m.running ? pctDelta(m.kept, m.prev.kept) : null} />
        <div className="flex-none w-px self-stretch max-md:hidden" style={{ background: 'var(--accent-line)' }} />
        <Big testid="mh-owed" tone={AMBER} dashed label="Clients still owe" value={money(m.stillOwed)} line={`Unpaid on ${m.owedFiles} file${m.owedFiles === 1 ? '' : 's'}. Not in the numbers on the left until they pay.`} />
      </div>

      <div className="grid gap-4 mt-5 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
        <Panel title={`${m.label} in plain words`} subtitle="Read this first — it says the same thing as the cards, in sentences" testid="mh-story">
          <ul className="m-0 pl-0 list-none flex flex-col gap-2.5 text-[14px] leading-relaxed">
            {m.story.map((s, i) => (
              <li key={i} className="flex gap-3"><span className="mt-[7px] w-2 h-2 rounded-full flex-none" style={{ background: 'var(--accent-2)' }} /><span>{s}</span></li>
            ))}
          </ul>
        </Panel>

        <Panel title="Needs your attention" subtitle="The few things worth doing next" testid="mh-attention">
          <div className="flex flex-col gap-2.5">
            {m.attention.map((a, i) => {
              const c = a.tone === 'bad' ? RED : a.tone === 'warn' ? AMBER : a.tone === 'good' ? GREEN : BLUE;
              return (
                <div key={i} className="flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ background: `color-mix(in srgb, ${c} 8%, white)`, border: `1px solid color-mix(in srgb, ${c} 25%, white)` }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: c }} />
                  <span className="flex-1 text-[13.5px] leading-snug">{a.text}</span>
                  <button className="btn btn-sm flex-none" onClick={() => go(a.go)}>{a.goLabel} →</button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 mt-4 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1fr 1.1fr' }}>
        <Panel title="Where the money went" subtitle={`${money(m.spent)} spent in ${m.label}`} testid="mh-spend">
          {m.spendGroups.length === 0
            ? <div className="text-[var(--muted)] text-[13.5px]">Nothing was spent in this month.</div>
            : <BarList color={RED} valueFmt={n => `${money(n)} · ${Math.round((n / spentTotal) * 100)}%`} rows={m.spendGroups.map(g => ({ label: g.label, value: g.amount, note: g.note }))} />}
        </Panel>
        <Panel title="Received and spent — the last 6 months" subtitle="Is the green bar usually taller than the red one?">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: 4, right: 8 }}>
                <CartesianGrid stroke="var(--accent-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: 'var(--accent-soft)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Received" fill={GREEN} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Spent" fill={RED} radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 mt-4 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
        <Panel title="Who owes us the most" subtitle={m.owedFiles > 5 ? `Top 5 of ${m.owedFiles} files with a balance` : `${m.owedFiles} file${m.owedFiles === 1 ? '' : 's'} with a balance`} testid="mh-owing"
          action={<button className="btn btn-sm" onClick={() => go('billing')}>See everyone →</button>} flush>
          {m.owingTop.length === 0
            ? <div className="p-5 text-[13.5px]" style={{ color: GREEN }}><b>Nobody owes anything.</b></div>
            : (
              <table>
                <thead><tr><th>Client</th><th>Open for</th><th style={{ textAlign: 'right' }}>Still owes</th></tr></thead>
                <tbody>
                  {m.owingTop.map(r => (
                    <tr key={r.caseId} data-testid="mh-owing-row">
                      <td><b>{r.name}</b><div className="text-[12px] text-[var(--muted)]">{r.destination}</div></td>
                      <td className="text-[var(--muted)]">{r.days} days</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: AMBER }}>{money(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Panel>

        <Panel title="Coming up — next 7 days" subtitle="Money due in from clients, and money due out" testid="mh-soon"
          action={<button className="btn btn-sm" onClick={() => go('payouts')}>Money going out →</button>} flush>
          <div className="grid grid-cols-2 gap-3 p-4 pb-2">
            <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, hsl(152 62% 32%) 8%, white)' }}><div className="text-[11px] uppercase font-bold tracking-wide" style={{ color: GREEN }}>Due in</div><div className="font-display text-[20px] font-semibold" style={{ color: GREEN }}>{money(m.soonIn)}</div></div>
            <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, hsl(352 62% 44%) 8%, white)' }}><div className="text-[11px] uppercase font-bold tracking-wide" style={{ color: RED }}>Due out</div><div className="font-display text-[20px] font-semibold" style={{ color: RED }}>{money(m.soonOut)}</div></div>
          </div>
          {m.soon.length === 0
            ? <div className="p-5 pt-2 text-[13.5px] text-[var(--muted)]">Nothing is due in the next 7 days.</div>
            : (
              <div className="px-4 pb-3" style={{ maxHeight: 300, overflow: 'auto' }}>
                {m.soon.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 text-[13px]" style={{ borderBottom: '1px solid var(--accent-line)' }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-none text-[13px] font-bold" style={{ background: s.kind === 'in' ? 'color-mix(in srgb, hsl(152 62% 32%) 12%, white)' : 'color-mix(in srgb, hsl(352 62% 44%) 12%, white)', color: s.kind === 'in' ? GREEN : RED }}>{s.kind === 'in' ? '↓' : '↑'}</span>
                    <span className="flex-1 min-w-0"><b className="block truncate">{s.who}</b><span className="text-[12px] text-[var(--muted)]">{s.what} · {s.date ? (s.date < todayStr ? `late since ${fmtDate(s.date)}` : fmtDate(s.date)) : 'no date'}</span></span>
                    <b className="flex-none" style={{ color: s.kind === 'in' ? GREEN : RED }}>{s.kind === 'in' ? '+' : '−'}{money(s.amount)}</b>
                  </div>
                ))}
              </div>
            )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Where do I record things?" subtitle="Money only moves in these places — everything else on this page is worked out from them">
          <div className="grid gap-3 max-md:grid-cols-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              ['A client paid us', 'Open the client’s case and press “Record a payment”. Their balance and every number here update by themselves.', 'Open Cases', 'cases', GREEN],
              ['We paid someone', 'Rent, ads and bills: Books & Banks → Add expense. Salaries: Payroll. Embassy fees: add them on the case.', 'Books & Banks', 'accounts', RED],
              ['A month has ended', 'Month-End shows the cash in and out and the balance to carry forward. Close it by the 5th.', 'Open Month-End', 'closing', BLUE],
            ].map(([t, d, b, id, c]) => (
              <div key={t} className="rounded-2xl p-4" style={{ borderLeft: `4px solid ${c}`, background: 'var(--accent-soft)' }}>
                <div className="font-display text-[16px] font-semibold" style={{ color: c }}>{t}</div>
                <div className="text-[13px] leading-relaxed mt-1 text-[#33405a]">{d}</div>
                <button className="btn btn-sm mt-3" onClick={() => go(id)}>{b} →</button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 mb-2">
        <button className="btn" data-testid="mh-words" onClick={() => setShowWords(v => !v)}>{showWords ? '▾' : '▸'} What do these words mean?</button>
        {showWords && (
          <div className="mt-3"><Callout tone="info" title="Finance in plain words">
            <dl className="m-0 grid gap-x-6 gap-y-2.5 max-md:grid-cols-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {GLOSSARY.map(([t, d]) => (<div key={t}><dt className="font-bold">{t}</dt><dd className="m-0 text-[13px] text-[#33405a]">{d}</dd></div>))}
            </dl>
          </Callout></div>
        )}
      </div>
    </div>
  );
}
