'use client';
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, today } from '@/lib/constants';
import { printSheet } from '@/lib/printSheet';
import { monthLabel, shiftMonth } from '@/lib/finance';
import {
  statementFor, keptApart, compare, trend, outlook, notesFor, changePct,
  type MonthStats, type ProfitInput,
} from '@/lib/profit';

const ARIAL = 'Arial, Helvetica, sans-serif';
const NAVY = '#14213D';
const GREEN = '#0B6E4F';
const RED = '#B5433A';
const MUTED = '#5B6270';

const th: CSSProperties = { background: NAVY, color: '#fff', padding: '10px 13px', fontSize: 13.5, fontWeight: 700, textAlign: 'left', fontFamily: ARIAL };
const td: CSSProperties = { padding: '10px 13px', fontSize: 14.5, borderBottom: '1px solid #e3e8ea', fontFamily: ARIAL };
const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
const h2: CSSProperties = { fontSize: 18, fontWeight: 700, color: NAVY, margin: '30px 0 8px', fontFamily: ARIAL, breakAfter: 'avoid', pageBreakAfter: 'avoid' };
const hint: CSSProperties = { fontSize: 13.5, color: MUTED, margin: '0 0 10px', lineHeight: 1.5 };

const pct = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}%`);

type Fmt = 'money' | 'count' | 'ratio';
interface GRow { key: string; label: string; pick: (s: MonthStats) => number | null; fmt: Fmt; higherIsBetter: boolean; note?: string }
const GROWTH_ROWS: GRow[] = [
  { key: 'leads', label: 'New leads', pick: s => s.leads, fmt: 'count', higherIsBetter: true },
  { key: 'files', label: 'Files closed', pick: s => s.filesClosed, fmt: 'count', higherIsBetter: true },
  { key: 'booked', label: 'Business sold (value of files closed)', pick: s => s.booked, fmt: 'money', higherIsBetter: true, note: 'Sold, not necessarily collected yet' },
  { key: 'avgfile', label: 'Average file value', pick: s => (s.filesClosed ? s.avgFile : null), fmt: 'money', higherIsBetter: true },
  { key: 'per100', label: 'Files closed per 100 leads', pick: s => s.filesPer100Leads, fmt: 'ratio', higherIsBetter: true },
  { key: 'collected', label: 'Money received from clients', pick: s => s.collected, fmt: 'money', higherIsBetter: true },
  { key: 'adspend', label: 'Advertising spent', pick: s => s.adSpend, fmt: 'money', higherIsBetter: false },
  { key: 'cpl', label: 'Advertising cost per lead', pick: s => s.costPerLead, fmt: 'money', higherIsBetter: false },
  { key: 'cpf', label: 'Advertising cost per closed file', pick: s => s.costPerFile, fmt: 'money', higherIsBetter: false },
  { key: 'net', label: 'Net profit', pick: s => s.netProfit, fmt: 'money', higherIsBetter: true },
  { key: 'owed', label: 'Unpaid client balances at month-end', pick: s => s.receivable, fmt: 'money', higherIsBetter: false },
];
const show = (v: number | null, f: Fmt) => (v === null ? '—' : f === 'money' ? money(v) : f === 'ratio' ? (Math.round(v * 10) / 10).toString() : Math.round(v).toLocaleString('en-US'));

function Line2({ k, label, value, sign, strong, sub, indent }: { k: string; label: ReactNode; value: number; sign?: '+' | '−' | '='; strong?: boolean; sub?: boolean; indent?: boolean }) {
  return (
    <tr data-testid={`ps-${k}`} style={strong ? { background: '#F2F8F5' } : undefined}>
      <td style={{ ...td, fontWeight: strong ? 700 : 400, fontSize: sub ? 13.5 : strong ? 16 : 14.5, paddingLeft: indent ? 34 : 13, color: sub ? MUTED : undefined }}>
        {sign && <span style={{ color: sign === '−' ? RED : GREEN, fontWeight: 700, marginRight: 8 }}>{sign}</span>}{label}
      </td>
      <td style={{ ...td, ...right, fontWeight: strong ? 700 : 400, fontSize: sub ? 13.5 : strong ? 16 : 14.5, color: sub ? MUTED : undefined }}>{money(value)}</td>
    </tr>
  );
}

function Kept({ k, title, value, children, tone = NAVY }: { k: string; title: string; value: string; children?: ReactNode; tone?: string }) {
  return (
    <div data-testid={`kept-${k}`} style={{ border: '1px solid #cfd8dc', padding: '12px 14px', background: '#F7F9FA' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone, margin: '3px 0', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

export function ProfitGrowth() {
  const { transactions, cases, leads, payRuns, loans, personalExpenses, appointments } = useAppData();
  const todayStr = today();
  const currentMonth = todayStr.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const input: ProfitInput = useMemo(
    () => ({ transactions, cases, leads, payRuns, loans, personalExpenses, appointments }),
    [transactions, cases, leads, payRuns, loans, personalExpenses, appointments],
  );
  const st = useMemo(() => statementFor(month, input, todayStr), [month, input, todayStr]);
  const kept = useMemo(() => keptApart(month, input, todayStr), [month, input, todayStr]);
  const cmp = useMemo(() => compare(month, input, todayStr), [month, input, todayStr]);
  const tr = useMemo(() => trend(month, input, todayStr, 6), [month, input, todayStr]);
  const out = useMemo(() => outlook(input, todayStr), [input, todayStr]);
  const notes = useMemo(() => notesFor(month, input, todayStr), [month, input, todayStr]);

  const running = month >= currentMonth;
  const dProfit = cmp.prev ? changePct(st.netProfit, cmp.prev.netProfit) : null;
  const fcRows = [kept.receivableForecast.overdue, ...kept.receivableForecast.months, kept.receivableForecast.later, kept.receivableForecast.undated].filter(b => b.amount > 0);
  const outRows = [out.forecast.overdue, ...out.forecast.months, out.forecast.later, out.forecast.undated].filter(b => b.amount > 0);
  const chartData = tr.map(p => ({ label: monthLabel(p.month).replace(/ 20/, " '"), 'Money in': p.moneyIn, 'Money out': p.moneyOut, 'Net profit': p.net }));

  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="no-print flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button className="btn" style={{ fontSize: 15, padding: '9px 14px' }} data-testid="pg-earlier" onClick={() => setMonth(shiftMonth(month, -1))}>‹ Earlier</button>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, minWidth: 190, textAlign: 'center' }} data-testid="pg-month">{monthLabel(month)}</div>
          <button className="btn" style={{ fontSize: 15, padding: '9px 14px' }} data-testid="pg-later" disabled={month >= currentMonth} onClick={() => setMonth(shiftMonth(month, 1))}>Later ›</button>
        </div>
        <button className="btn btn-primary" style={{ fontSize: 15, padding: '10px 18px' }} onClick={printSheet}>Print / Save as PDF</button>
      </div>

      <div id="invoice-print-area" style={{ background: '#fff', border: '1px solid #DCE5E0', borderRadius: 10, padding: 30, color: '#1a1a1a', fontFamily: ARIAL }}>
        <div style={{ fontSize: 13, color: MUTED }}>Profit &amp; Growth · {monthLabel(month)}{running ? ' · month still running — figures so far' : ''}</div>

        {/* ---- Net profit ---- */}
        <div data-testid="ps-hero" style={{ background: st.netProfit >= 0 ? '#E7F6EF' : '#FCEEEC', border: `1px solid ${st.netProfit >= 0 ? '#9fd3bd' : '#e5aaa4'}`, padding: '18px 22px', marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>NET PROFIT — {monthLabel(month).toUpperCase()}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Money actually received minus money actually paid out in the month</div>
            <div data-testid="ps-compare" style={{ fontSize: 13.5, marginTop: 6, color: dProfit === null ? MUTED : dProfit >= 0 ? GREEN : RED, fontWeight: 700 }}>
              {cmp.prev
                ? (dProfit === null ? `Last month: ${money(cmp.prev.netProfit)}` : `${dProfit >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(dProfit))}% compared with last month (${money(cmp.prev.netProfit)})`)
                : 'No earlier month to compare with yet'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div data-testid="ps-net-value" style={{ fontSize: 34, fontWeight: 700, color: st.netProfit >= 0 ? GREEN : RED }}>{st.netProfit < 0 ? '− ' : ''}{money(Math.abs(st.netProfit))}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{st.margin === null ? 'no earnings yet' : `${Math.round(st.margin * 100)}% of what the business earned`}</div>
          </div>
        </div>

        {notes.length > 0
          ? (
            <div data-testid="pg-notes" style={{ marginTop: 14 }}>
              <div style={{ ...hint, fontWeight: 700, color: NAVY, margin: '0 0 6px' }}>Worth a look</div>
              {notes.map((n, i) => (
                <div key={i} data-testid={`pg-note-${i}`} style={{ fontSize: 14, padding: '8px 12px', marginBottom: 6, borderLeft: `4px solid ${n.severity === 'alert' ? RED : '#C9962B'}`, background: n.severity === 'alert' ? '#FCEEEC' : '#FBF0DD' }}>{n.text}</div>
              ))}
            </div>
          )
          : <div data-testid="pg-notes-none" style={{ ...hint, marginTop: 10 }}>Nothing stands out this month.</div>}

        {/* ---- Statement ---- */}
        <h2 style={h2}>1. Where the profit comes from</h2>
        <div style={hint}>Every payment counts in the month it was actually received or paid. Nothing is counted just because a file was sold.</div>
        <table className="avoid-break" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc' }}>
          <thead><tr><th style={th}>Money in</th><th style={{ ...th, ...right }}>Amount</th></tr></thead>
          <tbody>
            <Line2 k="clientMoney" label="Payments received from clients" value={st.clientMoney} sign="+" />
            {st.otherIncome > 0 && <Line2 k="otherIncome" label="Other income (fines, misc.)" value={st.otherIncome} sign="+" />}
            <Line2 k="totalIn" label="Total money in" value={st.totalIn} strong />
          </tbody>
          <tbody>
            <tr><th style={{ ...th, textTransform: 'uppercase', letterSpacing: '.03em' }}>Money out</th><th style={{ ...th, ...right, textTransform: 'uppercase', letterSpacing: '.03em' }}>Amount</th></tr>
            <Line2 k="passThrough" label={<>Embassy fees paid for clients <span style={{ color: MUTED, fontSize: 12.5 }}>(passes through — collected from the client, paid on)</span></>} value={st.passThrough} sign="−" />
            <Line2 k="salaries" label="Salaries paid" value={st.salaries} sign="−" />
            {st.commissionsBonuses > 0 && <Line2 k="commissionsBonuses" label="Commissions, bonuses and appreciation to staff" value={st.commissionsBonuses} sign="−" />}
            {st.advances > 0 && <Line2 k="advances" label="Salary advances given" value={st.advances} sign="−" />}
            {st.referral > 0 && <Line2 k="referral" label="Referral agent commissions" value={st.referral} sign="−" />}
            <Line2 k="advertising" label="Advertising (ads and campaigns)" value={st.advertising} sign="−" />
            <Line2 k="office" label="Rent, utilities and other office costs" value={st.office} sign="−" />
            {st.officeRows.map(r => <Line2 key={r.category} k={`office-${r.category}`} label={r.category} value={r.total} sub indent />)}
            <Line2 k="totalOut" label="Total money out" value={st.totalOut} strong />
          </tbody>
          <tbody>
            <tr data-testid="ps-net" style={{ background: st.netProfit >= 0 ? '#E7F6EF' : '#FCEEEC' }}>
              <td style={{ ...td, fontWeight: 700, fontSize: 17 }}>= Net profit (money in − money out)</td>
              <td style={{ ...td, ...right, fontWeight: 700, fontSize: 17, color: st.netProfit >= 0 ? GREEN : RED }}>{st.netProfit < 0 ? '− ' : ''}{money(Math.abs(st.netProfit))}</td>
            </tr>
            <tr data-testid="ps-earned">
              <td style={{ ...td, color: MUTED, fontSize: 13.5 }}>What the business actually earned (money in − embassy fees passed on)</td>
              <td style={{ ...td, ...right, color: MUTED, fontSize: 13.5 }}>{money(st.serviceIncome)}</td>
            </tr>
          </tbody>
        </table>

        {/* ---- Kept apart ---- */}
        <h2 style={h2}>2. Money that is not profit — kept apart</h2>
        <div style={hint}>These amounts are real, but none of them is inside the net profit above. They are shown here so they can never inflate it — or be forgotten.</div>
        <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <Kept k="receivable" title={`Clients still owe — at ${fmtDate(st.end)}`} value={money(kept.receivable)} tone={kept.receivable > 0 ? RED : GREEN}>
            {kept.receivable > 0 ? (
              <>
                {kept.receivableFiles} file{kept.receivableFiles === 1 ? '' : 's'}. Counts as profit in the month it is received, not before.
                <div style={{ marginTop: 6 }}>
                  {fcRows.map(b => (
                    <div key={b.key} data-testid={`kept-recv-${b.key}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>{b.key === 'overdue' ? 'Already due' : b.key === 'undated' ? 'No date given yet' : b.label}</span><b>{money(b.amount)}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : 'Every file is fully paid.'}
          </Kept>
          <Kept k="payroll" title="Salaries approved but not paid yet" value={money(kept.unpaidPayroll)} tone={kept.unpaidPayroll > 0 ? '#8a5a12' : GREEN}>
            {kept.unpaidPayroll > 0 ? `${kept.unpaidPayrollStaff} staff. Leaves your cash when you pay it — then it counts as a cost in that month. As of today.` : 'Nothing waiting. As of today.'}
          </Kept>
          <Kept k="referral" title="Referral commission earned, not paid" value={money(kept.referralOwed)} tone={kept.referralOwed > 0 ? '#8a5a12' : GREEN}>
            {kept.referralOwed > 0 ? `${kept.referralFiles} file${kept.referralFiles === 1 ? '' : 's'}. Counts as a cost when it is paid. As of today.` : 'Nothing owed to agents. As of today.'}
          </Kept>
          <Kept k="loans" title="Loans" value={money(kept.loansGiven - kept.loansTaken)}>
            {kept.loansGiven || kept.loansTaken ? <>Owed to you {money(kept.loansGiven)} · you owe {money(kept.loansTaken)}. Loans are never income or expense. As of today.</> : 'No active loans.'}
          </Kept>
        </div>
        <div data-testid="kept-personal" style={{ ...hint, marginTop: 10 }}>
          Personal spending drawn in {monthLabel(month)}: <b>{money(kept.personal)}</b> — recorded under Personal expenses and never counted as a business cost.
        </div>

        {/* ---- Growth ---- */}
        <h2 style={h2}>3. Growth</h2>
        <div style={hint}>This month against last month and against the same month a year ago. Green means moving the right way.</div>
        <table className="avoid-break" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc' }} data-testid="growth-table">
          <thead><tr><th style={th}>&nbsp;</th><th style={{ ...th, ...right }}>{monthLabel(month)}</th><th style={{ ...th, ...right }}>Last month</th><th style={{ ...th, ...right }}>Change</th><th style={{ ...th, ...right }}>Year ago</th><th style={{ ...th, ...right }}>Change</th></tr></thead>
          <tbody>
            {GROWTH_ROWS.map(r => {
              const cur = r.pick(cmp.cur); const p = cmp.prev ? r.pick(cmp.prev) : null; const y = cmp.yearAgo ? r.pick(cmp.yearAgo) : null;
              const dp = changePct(cur, p); const dy = changePct(cur, y);
              const colour = (d: number | null) => (d === null || Math.abs(d) < 0.5 ? MUTED : (d > 0) === r.higherIsBetter ? GREEN : RED);
              return (
                <tr key={r.key} data-testid={`growth-${r.key}`}>
                  <td style={td}>{r.label}{r.note && <div style={{ fontSize: 12, color: MUTED }}>{r.note}</div>}</td>
                  <td style={{ ...td, ...right, fontWeight: 700 }}>{show(cur, r.fmt)}</td>
                  <td style={{ ...td, ...right }}>{cmp.prev ? show(p, r.fmt) : '—'}</td>
                  <td style={{ ...td, ...right, fontWeight: 700, color: colour(dp) }} data-testid={`growth-${r.key}-vs-prev`}>{pct(dp)}</td>
                  <td style={{ ...td, ...right }}>{cmp.yearAgo ? show(y, r.fmt) : '—'}</td>
                  <td style={{ ...td, ...right, fontWeight: 700, color: colour(dy) }} data-testid={`growth-${r.key}-vs-year`}>{pct(dy)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!cmp.prev && <div style={{ ...hint, marginTop: 8 }}>There is no record for the month before, so there is nothing to compare with yet.</div>}

        <div style={{ ...hint, fontWeight: 700, color: NAVY, margin: '18px 0 6px' }}>Last six months</div>
        <div className="no-print" style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#e3e8ea" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => money(Number(v))} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Money in" stroke="#0B6E4F" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Money out" stroke="#B5433A" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Net profit" stroke="#14213D" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="avoid-break" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc', marginTop: 10 }} data-testid="trend-table">
          <thead><tr><th style={th}>Month</th><th style={{ ...th, ...right }}>Money in</th><th style={{ ...th, ...right }}>Money out</th><th style={{ ...th, ...right }}>Net profit</th><th style={{ ...th, ...right }}>Clients owed at month-end</th></tr></thead>
          <tbody>
            {tr.map(p => (
              <tr key={p.month} data-testid={`trend-${p.month}`}>
                <td style={td}>{monthLabel(p.month)}</td>
                <td style={{ ...td, ...right }}>{p.hasData ? money(p.moneyIn) : '—'}</td>
                <td style={{ ...td, ...right }}>{p.hasData ? money(p.moneyOut) : '—'}</td>
                <td style={{ ...td, ...right, fontWeight: 700, color: p.net >= 0 ? GREEN : RED }}>{p.hasData ? `${p.net < 0 ? '− ' : ''}${money(Math.abs(p.net))}` : '—'}</td>
                <td style={{ ...td, ...right }}>{p.hasData ? money(p.receivable) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- Outlook ---- */}
        <h2 style={h2}>4. What is coming in</h2>
        <div style={hint}>Judged from today: money clients have already promised or are due to pay on files that are open, against what the business normally spends in a month.</div>
        <div data-testid="outlook" className="avoid-break" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          <div style={{ border: '1px solid #cfd8dc', padding: '12px 14px', background: '#F7F9FA' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 6 }}>Still to collect on open files — {money(out.forecast.total)}</div>
            {outRows.length === 0 && <div style={{ fontSize: 13.5, color: GREEN, fontWeight: 700 }}>Nothing outstanding.</div>}
            {outRows.map(b => (
              <div key={b.key} data-testid={`out-${b.key}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '3px 0' }}>
                <span>{b.key === 'overdue' ? 'Overdue (date passed)' : b.key === 'undated' ? 'No date given yet' : b.label}<span style={{ color: MUTED, fontSize: 12.5 }}> · {b.files} client{b.files === 1 ? '' : 's'}</span></span>
                <b style={{ color: b.key === 'overdue' ? RED : undefined }}>{money(b.amount)}</b>
              </div>
            ))}
          </div>
          <div data-testid="outlook-cost" style={{ border: '1px solid #cfd8dc', padding: '12px 14px', background: '#F7F9FA' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>Normal monthly spending</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: '3px 0' }}>{out.monthsUsed ? money(out.typicalCost) : '—'}</div>
            <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45 }}>{out.monthsUsed ? `Average money out over the last ${out.monthsUsed} month${out.monthsUsed === 1 ? '' : 's'}.` : 'Needs at least one finished month of records.'}</div>
          </div>
        </div>

        {/* ---- Method ---- */}
        <h2 style={h2}>How these numbers are worked out</h2>
        <div data-testid="pg-method" style={{ fontSize: 13.5, color: '#2b3340', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px' }}><b>Half now, half later.</b> A client who pays half today and half at the appointment is counted twice, each time in the month the money actually arrives: the first half in this month&apos;s profit, the second half in the month it is received. Until then the unpaid half sits under &ldquo;Clients still owe&rdquo; and is carried forward month after month. It never inflates a month it was not received in, and it is never lost.</p>
          <p style={{ margin: '0 0 8px' }}><b>Which balance a payment settles.</b> Each new payment settles the oldest unpaid part of that client&apos;s payment plan first (the plan is on the case file). A payment that is bigger than that part carries on into the next one.</p>
          <p style={{ margin: '0 0 8px' }}><b>Net profit</b> is money received minus money paid out in the month. Embassy fees are shown as money out but are only passed through from the client, which is why the &ldquo;actually earned&rdquo; line takes them out. Salaries count when they are paid (the 5th of the next month), so a month&apos;s profit includes the previous month&apos;s payroll.</p>
          <p style={{ margin: 0 }}><b>Growth</b> compares the same measures for different months. Loans, personal spending, unpaid client balances, unpaid salaries and unpaid referral commission are kept out of both profit and growth.</p>
        </div>
      </div>
    </div>
  );
}
