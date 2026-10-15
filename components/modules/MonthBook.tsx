'use client';
import { useAppData } from '@/lib/AppDataContext';
import { money, today } from '@/lib/constants';
import { monthBook, monthFolders } from '@/lib/caseBook';
import { monthLabel } from '@/lib/finance';

// "Finance details" for one month of cases: how many cases, how many are still in
// progress and how many are closed, what each agent brought in, how much of it is
// really ours (appointment / embassy fees are passed on), what clients have paid and
// what is still owed and carried into the coming months.

const NAVY = '#14213D';
const tile = (label: string, value: string, sub?: string, color?: string, testid?: string) => (
  <div key={label} data-testid={testid} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '11px 14px', background: '#fff', minWidth: 0 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    <div style={{ fontSize: 21, fontWeight: 700, color: color || NAVY, margin: '3px 0 1px', whiteSpace: 'nowrap' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.35 }}>{sub}</div>}
  </div>
);

export function MonthBookCard({ month }: { month: string }) {
  const { cases, transactions, team } = useAppData();
  const b = monthBook(month, cases, transactions, team, today());
  const th: React.CSSProperties = { background: NAVY, color: '#fff', padding: '9px 11px', fontSize: 12, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 11px', fontSize: 13, borderBottom: '1px solid #E3E8EF' };
  const r: React.CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
  const isCurrent = month === today().slice(0, 7);

  return (
    <div data-testid="month-book" data-month={month} style={{ marginTop: 18, border: '1px solid var(--line)', borderRadius: 14, background: '#F8FAFC', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>Finance details — {b.label}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{isCurrent ? 'Month still running — figures so far' : 'Cases closed in this month · money counted as received'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {tile('Cases', String(b.cases), `${b.applicants} applicant${b.applicants === 1 ? '' : 's'}${b.families ? ` · ${b.families} family file${b.families === 1 ? '' : 's'}` : ''}`, undefined, 'bk-cases')}
        {tile('In progress', String(b.inProgress), 'still being worked on', '#8a5a12', 'bk-progress')}
        {tile('Closed', String(b.finished), `${b.approved} approved · ${b.refused} refused · ${b.closed} closed`, '#0B6E4F', 'bk-closed')}
        {tile('Total sales', money(b.billed), b.discounts ? `after ${money(b.discounts)} discount` : 'charged to clients', undefined, 'bk-billed')}
        {tile('Our business', money(b.ourBusiness), b.apptCharges ? `without ${money(b.apptCharges)} appointment fees passed on` : 'service fees', '#0B6E4F', 'bk-ours')}
        {tile('Clients paid', money(b.paid), 'on these cases, up to today', '#0B6E4F', 'bk-paid')}
        {tile('Still pending', money(b.pending), 'on these cases — carried forward', b.pending > 0 ? '#B5433A' : '#0B6E4F', 'bk-pending')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 10 }}>
        {tile('Cash received in the month', money(b.collectedInMonth), `${money(b.collectedFromThese)} from these cases · ${money(b.collectedFromEarlier)} from earlier cases`, undefined, 'bk-cash')}
        {tile(`Owed by all clients on ${b.month === today().slice(0, 7) ? 'today' : 'the last day'}`, money(b.pendingAtMonthEnd), 'carried into the coming months', b.pendingAtMonthEnd > 0 ? '#B5433A' : '#0B6E4F', 'bk-carry')}
        {tile('Embassy / appointment payouts', money(b.outlaysPlanned), b.outlaysPlanned ? `${money(b.outlaysPosted)} already in Expenses · ${money(b.outlaysPlanned - b.outlaysPosted)} to come` : 'none listed on these cases', undefined, 'bk-outlays')}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, margin: '16px 0 6px' }}>Every agent — cases and business</div>
      {b.agents.length === 0
        ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No cases in {b.label}.</div>
        : (
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--line)', background: '#fff' }}>
            <table data-testid="bk-agents" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={th}>Agent</th><th style={{ ...th, ...r }}>Cases</th><th style={{ ...th, ...r }}>Closed</th><th style={{ ...th, ...r }}>Sales</th><th style={{ ...th, ...r }}>Our business</th><th style={{ ...th, ...r }}>Paid</th><th style={{ ...th, ...r }}>Pending</th></tr></thead>
              <tbody>
                {b.agents.map(a => (
                  <tr key={a.staffId || 'none'} data-testid="bk-agent-row">
                    <td style={{ ...td, fontWeight: 600 }}>{a.name}{a.applicants > a.cases && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}> · {a.applicants} applicants</span>}</td>
                    <td style={{ ...td, ...r }}>{a.cases}</td>
                    <td style={{ ...td, ...r }}>{a.closed}</td>
                    <td style={{ ...td, ...r }}>{money(a.billed)}</td>
                    <td style={{ ...td, ...r, fontWeight: 700 }}>{money(a.ourBusiness)}</td>
                    <td style={{ ...td, ...r, color: '#0B6E4F' }}>{money(a.paid)}</td>
                    <td style={{ ...td, ...r, color: a.pending > 0 ? '#B5433A' : '#0B6E4F' }}>{money(a.pending)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#F2F8F5' }}>
                  <td style={{ ...td, fontWeight: 700 }}>Total</td>
                  <td style={{ ...td, ...r, fontWeight: 700 }}>{b.cases}</td>
                  <td style={{ ...td, ...r, fontWeight: 700 }}>{b.finished}</td>
                  <td style={{ ...td, ...r, fontWeight: 700 }}>{money(b.billed)}</td>
                  <td style={{ ...td, ...r, fontWeight: 700 }}>{money(b.ourBusiness)}</td>
                  <td style={{ ...td, ...r, fontWeight: 700 }}>{money(b.paid)}</td>
                  <td style={{ ...td, ...r, fontWeight: 700 }}>{money(b.pending)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
        <b>Our business</b> = what clients are charged minus the appointment / embassy fees we pass on. <b>Paid</b> and <b>Pending</b> are measured today, per case, so a balance that arrives next month moves from pending to paid.
      </div>
    </div>
  );
}

// Month by month: one row per month of cases, newest first. Used at the bottom of the
// "All cases" view; a click opens that month's folder.
export function MonthByMonth({ onOpen }: { onOpen: (month: string) => void }) {
  const { cases, transactions, team } = useAppData();
  const todayStr = today();
  const rows = monthFolders(cases).filter(f => f.month !== 'unknown').map(f => monthBook(f.month, cases, transactions, team, todayStr));
  if (!rows.length) return null;
  const th: React.CSSProperties = { background: NAVY, color: '#fff', padding: '9px 11px', fontSize: 12, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '9px 11px', fontSize: 13, borderBottom: '1px solid #E3E8EF' };
  const r: React.CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
  const sum = (f: (b: typeof rows[number]) => number) => rows.reduce((s, b) => s + f(b), 0);
  return (
    <div data-testid="month-by-month" style={{ marginTop: 18, border: '1px solid var(--line)', borderRadius: 14, background: '#F8FAFC', padding: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Finance details — month by month</div>
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--line)', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead><tr><th style={th}>Month</th><th style={{ ...th, ...r }}>Cases</th><th style={{ ...th, ...r }}>In progress</th><th style={{ ...th, ...r }}>Closed</th><th style={{ ...th, ...r }}>Sales</th><th style={{ ...th, ...r }}>Our business</th><th style={{ ...th, ...r }}>Paid</th><th style={{ ...th, ...r }}>Pending</th></tr></thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.month} data-testid="mm-row" data-month={b.month}>
                <td style={td}><button style={{ fontWeight: 700, color: NAVY, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => onOpen(b.month)}>{monthLabel(b.month)}</button></td>
                <td style={{ ...td, ...r }}>{b.cases}</td><td style={{ ...td, ...r }}>{b.inProgress}</td><td style={{ ...td, ...r }}>{b.finished}</td>
                <td style={{ ...td, ...r }}>{money(b.billed)}</td><td style={{ ...td, ...r, fontWeight: 700 }}>{money(b.ourBusiness)}</td>
                <td style={{ ...td, ...r, color: '#0B6E4F' }}>{money(b.paid)}</td><td style={{ ...td, ...r, color: b.pending > 0 ? '#B5433A' : '#0B6E4F' }}>{money(b.pending)}</td>
              </tr>
            ))}
            <tr style={{ background: '#F2F8F5' }}>
              <td style={{ ...td, fontWeight: 700 }}>All months</td>
              <td style={{ ...td, ...r, fontWeight: 700 }}>{sum(b => b.cases)}</td><td style={{ ...td, ...r, fontWeight: 700 }}>{sum(b => b.inProgress)}</td><td style={{ ...td, ...r, fontWeight: 700 }}>{sum(b => b.finished)}</td>
              <td style={{ ...td, ...r, fontWeight: 700 }}>{money(sum(b => b.billed))}</td><td style={{ ...td, ...r, fontWeight: 700 }}>{money(sum(b => b.ourBusiness))}</td>
              <td style={{ ...td, ...r, fontWeight: 700 }}>{money(sum(b => b.paid))}</td><td style={{ ...td, ...r, fontWeight: 700 }}>{money(sum(b => b.pending))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
