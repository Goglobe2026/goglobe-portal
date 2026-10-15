'use client';
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, today } from '@/lib/constants';
import { monthLabel } from '@/lib/finance';
import { dayBook } from '@/lib/caseBook';
import { upcomingPayouts, expectedCollections, type PayoutMonth } from '@/lib/payouts';
import { MonthBookCard } from './MonthBook';

// Upcoming payouts: what is going to leave the account (embassy fees, salaries, bonuses,
// commissions), what is coming in from clients, and what that leaves — month by month.
// On top, the actual business of the month (or of one day): ours, pending, collected.

const NAVY = '#14213D';
const GREEN = '#0B6E4F';
const RED = '#B5433A';
const AMBER = '#8a5a12';

const tile = (label: string, value: string, sub?: string, color?: string, testid?: string) => (
  <div key={label} data-testid={testid} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '11px 14px', background: '#fff', minWidth: 0 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    <div style={{ fontSize: 21, fontWeight: 700, color: color || NAVY, margin: '3px 0 1px', whiteSpace: 'nowrap' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.35 }}>{sub}</div>}
  </div>
);
const th: CSSProperties = { background: NAVY, color: '#fff', padding: '9px 11px', fontSize: 12, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '9px 11px', fontSize: 13, borderBottom: '1px solid #E3E8EF' };
const r: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
const card: CSSProperties = { border: '1px solid var(--line)', borderRadius: 14, background: '#fff', padding: 16, marginTop: 18 };
const h2: CSSProperties = { fontSize: 16, fontWeight: 700, color: NAVY, margin: 0 };

function DayCard({ date }: { date: string }) {
  const { cases, transactions, team } = useAppData();
  const d = dayBook(date, cases, transactions, team);
  return (
    <div data-testid="day-book" data-date={date} style={{ marginTop: 18, border: '1px solid var(--line)', borderRadius: 14, background: '#F8FAFC', padding: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12 }}>Business on {fmtDate(date)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tile('Cases closed', String(d.cases), `${d.applicants} applicant${d.applicants === 1 ? '' : 's'}`, undefined, 'day-cases')}
        {tile('Total sales', money(d.billed), 'charged to clients', undefined, 'day-billed')}
        {tile('Our business', money(d.ourBusiness), d.apptCharges ? `without ${money(d.apptCharges)} appointment fees` : 'service fees', GREEN, 'day-ours')}
        {tile('Pending on these cases', money(d.pending), 'still to collect', d.pending > 0 ? RED : GREEN, 'day-pending')}
        {tile('Cash received', money(d.collected), `${money(d.fromToday)} from today’s cases · ${money(d.fromEarlier)} from earlier cases`, GREEN, 'day-cash')}
        {tile('Owed by all clients', money(d.owedAtEnd), 'at the end of the day', d.owedAtEnd > 0 ? RED : GREEN, 'day-owed')}
        {tile('Embassy payouts', money(d.payouts), 'left the account', undefined, 'day-payouts')}
      </div>
      {d.agents.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--line)', background: '#fff', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead><tr><th style={th}>Agent</th><th style={{ ...th, ...r }}>Cases</th><th style={{ ...th, ...r }}>Sales</th><th style={{ ...th, ...r }}>Our business</th><th style={{ ...th, ...r }}>Pending</th></tr></thead>
            <tbody>{d.agents.map(a => (
              <tr key={a.staffId || 'none'}><td style={{ ...td, fontWeight: 600 }}>{a.name}</td><td style={{ ...td, ...r }}>{a.cases}</td><td style={{ ...td, ...r }}>{money(a.billed)}</td><td style={{ ...td, ...r, fontWeight: 700 }}>{money(a.ourBusiness)}</td><td style={{ ...td, ...r, color: a.pending > 0 ? RED : GREEN }}>{money(a.pending)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Bucket({ b, tone, testid, open: openDefault }: { b: PayoutMonth; tone?: string; testid: string; open?: boolean }) {
  const [open, setOpen] = useState(!!openDefault);
  const [all, setAll] = useState(false);
  const rows = all ? b.items : b.items.slice(0, 12);
  return (
    <div data-testid={testid} style={{ border: '1px solid var(--line)', borderRadius: 12, background: '#fff', overflow: 'hidden', marginBottom: 8 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#F8FAFC', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontWeight: 700, color: tone || NAVY, fontSize: 14 }}>{open ? '▾' : '▸'} {b.label} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12.5 }}>· {b.items.length} payment{b.items.length === 1 ? '' : 's'}</span></span>
        <span data-testid={`${testid}-total`} style={{ fontWeight: 700, color: tone || NAVY, fontSize: 15 }}>{money(b.total)}</span>
      </button>
      {open && (b.items.length === 0
        ? <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--muted)' }}>Nothing here.</div>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={th}>Date</th><th style={th}>What</th><th style={th}>Who</th><th style={th}>Detail</th><th style={{ ...th, ...r }}>Amount</th></tr></thead>
              <tbody>
                {rows.map((it, i) => (
                  <tr key={i} data-testid="payout-row">
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{it.date ? fmtDate(it.date) : <span style={{ color: AMBER }}>no date</span>}</td>
                    <td style={td}>{it.kind}{!it.sure && <span style={{ marginLeft: 6, fontSize: 11, color: AMBER, fontWeight: 700 }}>ESTIMATE</span>}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{it.who}</td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{it.detail}</td>
                    <td style={{ ...td, ...r, fontWeight: 700 }}>{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {b.items.length > rows.length && <button type="button" className="btn btn-sm btn-ghost" style={{ margin: 8 }} onClick={() => setAll(true)}>Show all {b.items.length}</button>}
          </div>
        ))}
    </div>
  );
}

export function Payouts() {
  const { cases, team, payRuns, appointments, transactions } = useAppData();
  const todayStr = today();
  const [view, setView] = useState<'month' | 'day'>('month');
  const [month, setMonth] = useState(todayStr.slice(0, 7));
  const [day, setDay] = useState(todayStr);
  const out = useMemo(() => upcomingPayouts({ cases, team, payRuns }, todayStr, 3), [cases, team, payRuns, todayStr]);
  const inn = useMemo(() => expectedCollections(cases, appointments, todayStr, 3), [cases, appointments, todayStr]);

  const outlook = out.months.map((m, i) => {
    const inc = inn.months.find(x => x.key === m.key) || inn.months[i];
    return { key: m.key, label: m.label, out: m.total, inn: inc ? inc.amount : 0 };
  });
  const owedToUs = inn.total;
  const seg = (active: boolean): CSSProperties => ({ padding: '7px 16px', fontWeight: 700, fontSize: 13, borderRadius: 8, border: `1px solid ${active ? NAVY : 'var(--line)'}`, background: active ? NAVY : '#fff', color: active ? '#fff' : NAVY, cursor: 'pointer' });

  return (
    <div data-testid="payouts-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ ...h2, fontSize: 20 }}>Upcoming Payouts</h2>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>What is leaving the account, what is coming in from clients, and what the business really earned.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button data-testid="view-month" style={seg(view === 'month')} onClick={() => setView('month')}>Month</button>
          <button data-testid="view-day" style={seg(view === 'day')} onClick={() => setView('day')}>Day</button>
          {view === 'month'
            ? <input data-testid="pick-month" type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ width: 160 }} />
            : <input data-testid="pick-day" type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} style={{ width: 160 }} />}
        </div>
      </div>

      {view === 'month' ? <MonthBookCard month={month} /> : <DayCard date={day} />}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
          <div style={h2}>Money going out</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Embassy fees, salaries, bonuses and commissions not paid yet{out.estimated > 0 ? ` · ${money(out.estimated)} of it is an estimate` : ''}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, margin: '12px 0' }}>
          {tile('Total still to pay', money(out.total), 'everything listed below', RED, 'payouts-total')}
          {tile('Overdue', money(out.overdue.total), 'date passed, not paid', out.overdue.total > 0 ? RED : GREEN, 'payouts-overdue')}
          {tile(monthLabel(out.months[0].key), money(out.months[0].total), 'due this month', undefined, 'payouts-this-month')}
          {tile('No date yet', money(out.undated.total), 'add a date to schedule it', out.undated.total > 0 ? AMBER : GREEN, 'payouts-undated')}
        </div>
        {out.overdue.items.length > 0 && <Bucket b={out.overdue} tone={RED} testid="pb-overdue" open />}
        {out.months.map((m, i) => <Bucket key={m.key} b={m} testid={`pb-${m.key}`} open={i === 0} />)}
        {out.later.items.length > 0 && <Bucket b={out.later} testid="pb-later" />}
        {out.undated.items.length > 0 && <Bucket b={out.undated} tone={AMBER} testid="pb-undated" />}
        {out.total === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Nothing is waiting to be paid out.</div>}
      </div>

      <div style={card}>
        <div style={h2}>Month by month — in against out</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '3px 0 10px' }}>Money expected from clients (from their payment plans and promised dates) against the payouts above.</div>
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--line)' }}>
          <table data-testid="outlook" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead><tr><th style={th}>Month</th><th style={{ ...th, ...r }}>Expected in</th><th style={{ ...th, ...r }}>Going out</th><th style={{ ...th, ...r }}>Left over</th></tr></thead>
            <tbody>
              <tr data-testid="outlook-overdue"><td style={td}>Overdue — already due</td><td style={{ ...td, ...r }}>{money(inn.overdue.amount)}</td><td style={{ ...td, ...r }}>{money(out.overdue.total)}</td><td style={{ ...td, ...r, fontWeight: 700, color: inn.overdue.amount - out.overdue.total < 0 ? RED : GREEN }}>{money(inn.overdue.amount - out.overdue.total)}</td></tr>
              {outlook.map(o => (
                <tr key={o.key} data-testid="outlook-row" data-month={o.key}><td style={{ ...td, fontWeight: 600 }}>{o.label}</td><td style={{ ...td, ...r }}>{money(o.inn)}</td><td style={{ ...td, ...r }}>{money(o.out)}</td><td style={{ ...td, ...r, fontWeight: 700, color: o.inn - o.out < 0 ? RED : GREEN }}>{money(o.inn - o.out)}</td></tr>
              ))}
              <tr><td style={td}>Later</td><td style={{ ...td, ...r }}>{money(inn.later.amount)}</td><td style={{ ...td, ...r }}>{money(out.later.total)}</td><td style={{ ...td, ...r, fontWeight: 700, color: inn.later.amount - out.later.total < 0 ? RED : GREEN }}>{money(inn.later.amount - out.later.total)}</td></tr>
              <tr><td style={td}>No date set</td><td style={{ ...td, ...r }}>{money(inn.undated.amount)}</td><td style={{ ...td, ...r }}>{money(out.undated.total)}</td><td style={{ ...td, ...r, fontWeight: 700, color: inn.undated.amount - out.undated.total < 0 ? RED : GREEN }}>{money(inn.undated.amount - out.undated.total)}</td></tr>
              <tr style={{ background: '#F2F8F5' }}><td style={{ ...td, fontWeight: 700 }}>Total</td><td data-testid="outlook-in-total" style={{ ...td, ...r, fontWeight: 700 }}>{money(owedToUs)}</td><td data-testid="outlook-out-total" style={{ ...td, ...r, fontWeight: 700 }}>{money(out.total)}</td><td style={{ ...td, ...r, fontWeight: 700, color: owedToUs - out.total < 0 ? RED : GREEN }}>{money(owedToUs - out.total)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
          “Expected in” is what clients still owe, placed in the month their plan or promised date says. Salaries not yet created in Payroll are shown as estimates (salary + allowance of active staff). Payouts with a date in the past or today are already in Expenses and are not listed.
        </div>
      </div>
    </div>
  );
}
