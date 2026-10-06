'use client';
import { useState } from 'react';
import { printSheet } from '@/lib/printSheet';
import type { CSSProperties, ReactElement } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { LOGO_FULL } from '@/lib/logo';
import { computeMonth, monthLabel, shiftMonth, closingDueDate, daysBetween } from '@/lib/finance';
import type { MonthlyClosing as ClosingRecord } from '@/lib/types';

const ARIAL = 'Arial, Helvetica, sans-serif';
const NAVY = '#14213D';

export function MonthlyClosing() {
  const { monthlyClosings } = useAppData();
  const currentMonth = today().slice(0, 7);
  // The month you close is normally the one that just ended.
  const [month, setMonth] = useState(shiftMonth(currentMonth, -1));
  const closedMonths = monthlyClosings.map(c => c.month);

  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="no-print flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button className="btn" style={{ fontSize: 15, padding: '9px 14px' }} onClick={() => setMonth(shiftMonth(month, -1))}>‹ Earlier</button>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, minWidth: 190, textAlign: 'center' }}>{monthLabel(month)}</div>
          <button className="btn" style={{ fontSize: 15, padding: '9px 14px' }} disabled={month >= currentMonth} onClick={() => setMonth(shiftMonth(month, 1))}>Later ›</button>
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          {closedMonths.length ? `Closed so far: ${closedMonths.sort().map(m => monthLabel(m)).join(', ')}` : 'No month has been closed yet.'}
        </div>
      </div>
      <ClosingSheet key={month} month={month} />
    </div>
  );
}

function ClosingSheet({ month }: { month: string }) {
  const { transactions, cases, setCases, salarySlips, bankAccounts, monthlyClosings, setMonthlyClosings, logActivity } = useAppData();
  const toast = useToast();
  const todayStr = today();

  const closing = monthlyClosings.find(c => c.month === month);
  const prevClosing = monthlyClosings.find(c => c.month === shiftMonth(month, -1));
  const anyEarlier = monthlyClosings.some(c => c.month < month);
  const manualOpeningAllowed = !anyEarlier;

  const f = computeMonth(month, transactions, cases, salarySlips, todayStr);
  const monthEnded = todayStr > f.end;

  const [openingManual, setOpeningManual] = useState('');
  const [actualInput, setActualInput] = useState(closing && closing.actualClosing !== null ? String(closing.actualClosing) : '');
  const [note, setNote] = useState(closing?.note || '');

  const opening = closing ? closing.openingBalance : prevClosing ? prevClosing.carriedBalance : (manualOpeningAllowed ? Number(openingManual) || 0 : 0);
  const expected = opening + f.totalIn - f.totalOut;
  const actual: number | null = closing ? closing.actualClosing : (actualInput.trim() === '' ? null : Number(actualInput));
  const variance = actual === null ? null : actual - expected;
  const carried = actual === null ? expected : actual;
  const totalBank = bankAccounts.reduce((s, b) => s + b.balance, 0);

  const dueDate = closingDueDate(month);
  const daysLeft = daysBetween(todayStr, dueDate);
  const canClose = !closing && monthEnded && (!!prevClosing || manualOpeningAllowed);
  const latestClosed = monthlyClosings.map(c => c.month).sort().pop();
  const canReopen = !!closing && latestClosed === month;

  let statusText = ''; let statusColor = '#8a5a12'; let statusBg = '#FBF0DD';
  if (closing) { statusText = `CLOSED on ${fmtDate(closing.closedDate)}`; statusColor = '#0B6E4F'; statusBg = '#E7F6EF'; }
  else if (!monthEnded) { statusText = 'MONTH STILL RUNNING — figures so far'; }
  else if (daysLeft >= 0) { statusText = `OPEN — closing due ${fmtDate(dueDate)} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`; }
  else { statusText = `OPEN — closing was due ${fmtDate(dueDate)} (${-daysLeft} day${daysLeft === -1 ? '' : 's'} overdue)`; statusColor = '#B5433A'; statusBg = '#FCEEEC'; }

  const changedSinceClose = closing && (
    closing.collections !== f.collections || closing.otherIncome !== f.otherIncome || closing.salaries !== f.salaries ||
    closing.commissionsBonuses !== f.commissionsBonuses || closing.otherExpenses !== f.otherExpenses
  );

  function closeMonth() {
    if (!canClose) return;
    const msg = `Close ${monthLabel(month)}?\n\nBalance carried to ${monthLabel(shiftMonth(month, 1))}: ${money(carried)}\nPending collections carried forward: ${money(f.pendingTotal)}`;
    if (!window.confirm(msg)) return;
    const rec: ClosingRecord = {
      id: genId('mc'), month, openingBalance: opening, collections: f.collections, otherIncome: f.otherIncome,
      salaries: f.salaries, commissionsBonuses: f.commissionsBonuses, otherExpenses: f.otherExpenses,
      expectedClosing: expected, actualClosing: actual, carriedBalance: carried,
      carriedForwardPending: f.pendingTotal, bookedValue: f.bookedValue, note, closedDate: todayStr,
    };
    setMonthlyClosings(prev => [...prev, rec]);
    logActivity(`${monthLabel(month)} closed — carried balance ${money(carried)}`);
    toast(`${monthLabel(month)} closed`);
  }
  function reopen() {
    if (!closing || !canReopen) return;
    if (!window.confirm(`Reopen ${monthLabel(month)}? Its closing record will be removed and you can close it again after making corrections.`)) return;
    setMonthlyClosings(prev => prev.filter(x => x.id !== closing.id));
    logActivity(`${monthLabel(month)} reopened`);
    toast('Month reopened');
  }
  function setExpectedDate(caseId: string, date: string) {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, expectedPaymentDate: date } : c));
  }

  // ---- styles (Arial, generous sizes) ----
  const th: CSSProperties = { background: NAVY, color: '#fff', padding: '11px 13px', fontSize: 14, fontWeight: 700, textAlign: 'left', fontFamily: ARIAL };
  const td: CSSProperties = { padding: '11px 13px', fontSize: 15, borderBottom: '1px solid #e3e8ea', fontFamily: ARIAL };
  const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
  const h2: CSSProperties = { fontSize: 18, fontWeight: 700, color: NAVY, margin: '30px 0 10px', fontFamily: ARIAL, breakAfter: 'avoid', pageBreakAfter: 'avoid' };
  const hint: CSSProperties = { fontSize: 14, color: '#5B6270', margin: '-4px 0 10px', lineHeight: 1.5 };
  const lineRow = (label: string, value: number, sign: '+' | '−' | '', strong = false): ReactElement => (
    <tr style={strong ? { background: '#F2F8F5' } : undefined}>
      <td style={{ ...td, fontWeight: strong ? 700 : 400, fontSize: strong ? 17 : 15 }}>{sign && <span style={{ color: sign === '+' ? '#0B6E4F' : '#B5433A', fontWeight: 700, marginRight: 8 }}>{sign}</span>}{label}</td>
      <td style={{ ...td, ...right, fontWeight: strong ? 700 : 400, fontSize: strong ? 17 : 15 }}>{money(value)}</td>
    </tr>
  );

  return (
    <>
      <div className="no-print flex items-center gap-2 flex-wrap mb-4">
        <button className="btn btn-primary" style={{ fontSize: 15, padding: '10px 18px' }} onClick={printSheet}>Print / Save as PDF</button>
        {!closing && <button className="btn" style={{ fontSize: 15, padding: '10px 18px' }} disabled={!canClose} onClick={closeMonth}>Close {monthLabel(month)}</button>}
        {canReopen && <button className="btn" style={{ fontSize: 15, padding: '10px 18px' }} onClick={reopen}>Reopen month</button>}
        {!closing && !monthEnded && <span style={{ fontSize: 14, color: 'var(--muted)' }}>You can close this month once it has ended.</span>}
        {!closing && monthEnded && !prevClosing && !manualOpeningAllowed && <span style={{ fontSize: 14, color: '#B5433A' }}>Close {monthLabel(shiftMonth(month, -1))} first — each month starts from the previous month’s closing balance.</span>}
      </div>

      {changedSinceClose && closing && (
        <div className="no-print" style={{ background: '#FCEEEC', border: '1px solid #E3B8B0', padding: '12px 16px', marginBottom: 14, fontSize: 15, lineHeight: 1.5 }}>
          <b>Records for this month have changed since it was closed.</b> The closing expected a balance of {money(closing.expectedClosing)}; the records now give {money(expected)}. Reopen the month to correct the closing.
        </div>
      )}

      <div id="invoice-print-area" style={{ background: '#fff', border: '1px solid #DCE5E0', borderRadius: 10, padding: 30, color: '#1a1a1a', fontFamily: ARIAL }}>
        <div className="avoid-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
          <img src={LOGO_FULL} style={{ height: 60 }} alt="GoGlobe Consultant" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, letterSpacing: '.02em' }}>MONTHLY CLOSING REPORT</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{monthLabel(month)}</div>
          </div>
        </div>
        <div style={{ height: 5, background: 'linear-gradient(90deg,#1FA463,#1F6E8C,#14213D)', marginBottom: 14 }} />
        <div style={{ background: statusBg, color: statusColor, padding: '10px 14px', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{statusText}</div>
        <div style={{ fontSize: 13.5, color: '#5B6270' }}>Basis: cash received. A payment counts in the month it is actually received, whichever month the case was opened. Balances still owed are listed separately in section 6.</div>

        <h2 style={h2}>1. Cash position</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc' }}>
          <tbody>
            <tr>
              <td style={td}>Opening balance (cash + bank){!closing && !prevClosing && manualOpeningAllowed && <div style={{ fontSize: 13, color: '#8a5a12' }}>First month on the system — enter what you had at the start of {monthLabel(month)}.</div>}
                {prevClosing && <div style={{ fontSize: 13, color: '#5B6270' }}>Carried from {monthLabel(prevClosing.month)} closing</div>}</td>
              <td style={{ ...td, ...right }}>
                {closing || prevClosing || !manualOpeningAllowed
                  ? <b>{money(opening)}</b>
                  : <input type="number" value={openingManual} onChange={e => setOpeningManual(e.target.value)} placeholder="0" style={{ width: 170, fontSize: 16, padding: '7px 9px', textAlign: 'right', border: '1px solid #b8c4c0', borderRadius: 6 }} />}
              </td>
            </tr>
            {lineRow('Collections received from clients', f.collections, '+')}
            {lineRow('Other income', f.otherIncome, '+')}
            {lineRow('Salaries paid', f.salaries, '−')}
            {lineRow('Commissions & bonuses paid', f.commissionsBonuses, '−')}
            {lineRow('Other expenses', f.otherExpenses, '−')}
            {lineRow('Expected closing balance', expected, '', true)}
            <tr>
              <td style={td}>Actual cash + bank counted
                {!closing && <div className="no-print" style={{ fontSize: 13, color: '#5B6270' }}>Optional. Accounts currently shows {money(totalBank)} — <a href="#" style={{ color: '#0B6E4F', fontWeight: 700 }} onClick={e => { e.preventDefault(); setActualInput(String(totalBank)); }}>use this</a></div>}</td>
              <td style={{ ...td, ...right }}>
                {closing
                  ? <b>{closing.actualClosing === null ? '—' : money(closing.actualClosing)}</b>
                  : <input type="number" value={actualInput} onChange={e => setActualInput(e.target.value)} placeholder="not entered" style={{ width: 170, fontSize: 16, padding: '7px 9px', textAlign: 'right', border: '1px solid #b8c4c0', borderRadius: 6 }} />}
              </td>
            </tr>
            <tr>
              <td style={td}>Difference (counted − expected)</td>
              <td style={{ ...td, ...right, fontWeight: 700, color: variance === null ? '#5B6270' : variance === 0 ? '#0B6E4F' : '#B5433A' }}>
                {variance === null ? '—' : variance === 0 ? 'Matches' : `${variance > 0 ? '+' : '−'} ${money(Math.abs(variance))}`}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="avoid-break" style={{ background: '#FBF0DD', border: '1px solid #E8C784', padding: '16px 20px', marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>BALANCE CARRIED TO {monthLabel(shiftMonth(month, 1)).toUpperCase()}</div>
            <div style={{ fontSize: 13.5, color: '#5B6270' }}>{actual === null ? 'Based on the expected balance' : 'Based on the cash + bank amount counted'}</div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#0B6E4F' }}>{money(carried)}</div>
        </div>

        <h2 style={h2}>2. Business booked and cash collected</h2>
        <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            ['New business booked', money(f.bookedValue), `${f.newCaseCount} new case${f.newCaseCount === 1 ? '' : 's'} opened`],
            ['Cash collected', money(f.collections), 'received in this month'],
            ['…from this month’s cases', money(f.fromNew), `earlier cases: ${money(f.fromEarlier)}${f.unlinked ? ` · unlinked: ${money(f.unlinked)}` : ''}`],
            ['Still to collect', money(f.pendingTotal), 'carried forward — see section 6'],
          ].map(([a, b, c]) => (
            <div key={a} style={{ border: '1px solid #cfd8dc', padding: '12px 14px', background: '#F7F9FA' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>{a}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: NAVY, margin: '3px 0', whiteSpace: 'nowrap' }}>{b}</div>
              <div style={{ fontSize: 12.5, color: '#5B6270', lineHeight: 1.4 }}>{c}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>3. Collections received from clients</h2>
        {f.collectionRows.length === 0
          ? <div style={hint}>No client payments were recorded in {monthLabel(month)}.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc' }}>
              <thead><tr><th style={th}>Date</th><th style={th}>Client</th><th style={th}>Payment</th><th style={{ ...th, ...right }}>Amount</th><th style={{ ...th, ...right }}>Balance still owed</th></tr></thead>
              <tbody>
                {f.collectionRows.map(r => (
                  <tr key={r.tx.id}>
                    <td style={td}>{fmtDate(r.tx.date)}</td>
                    <td style={td}>{r.tx.party}{r.caseRec && <div style={{ fontSize: 12.5, color: '#5B6270' }}>{r.caseRec.destination} · {r.caseRec.referenceCode}</div>}</td>
                    <td style={td}>{r.label}</td>
                    <td style={{ ...td, ...right, fontWeight: 700 }}>{money(r.tx.amount)}</td>
                    <td style={{ ...td, ...right, color: r.balanceAfter > 0 ? '#B5433A' : '#0B6E4F' }}>{r.caseRec ? (r.balanceAfter > 0 ? money(r.balanceAfter) : 'Settled') : '—'}</td>
                  </tr>
                ))}
                <tr style={{ background: '#F2F8F5' }}><td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total collected</td><td style={{ ...td, ...right, fontWeight: 700 }}>{money(f.collections)}</td><td style={td} /></tr>
              </tbody>
            </table>}

        <h2 style={h2}>4. Staff payments made this month</h2>
        {f.staffPayments.length === 0
          ? <div style={hint}>No salary, commission or bonus payments were recorded in {monthLabel(month)}.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc' }}>
              <thead><tr><th style={th}>Date</th><th style={th}>Staff member</th><th style={th}>Type</th><th style={{ ...th, ...right }}>Amount</th></tr></thead>
              <tbody>
                {f.staffPayments.map(t => <tr key={t.id}><td style={td}>{fmtDate(t.date)}</td><td style={td}>{t.party}</td><td style={td}>{t.category}</td><td style={{ ...td, ...right }}>{money(t.amount)}</td></tr>)}
                <tr style={{ background: '#F2F8F5' }}><td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total paid to staff</td><td style={{ ...td, ...right, fontWeight: 700 }}>{money(f.salaries + f.commissionsBonuses)}</td></tr>
              </tbody>
            </table>}
        {f.unpaidSlips.length > 0 && (
          <div style={{ ...hint, marginTop: 10, color: '#8a5a12' }}>
            Salary slips generated but not yet paid: {f.unpaidSlips.map(s => `${s.staffName} (${monthLabel(s.month)}, ${money(s.netPay)})`).join(' · ')} — total {money(f.unpaidSlipsTotal)}.
          </div>
        )}

        <h2 style={h2}>5. Expenses by category</h2>
        {f.expenseRows.length === 0
          ? <div style={hint}>No expenses were recorded in {monthLabel(month)}.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc' }}>
              <thead><tr><th style={th}>Category</th><th style={{ ...th, ...right }}>Amount</th></tr></thead>
              <tbody>
                {f.expenseRows.map(r => <tr key={r.category}><td style={td}>{r.category}</td><td style={{ ...td, ...right }}>{money(r.total)}</td></tr>)}
                <tr style={{ background: '#F2F8F5' }}><td style={{ ...td, fontWeight: 700 }}>Total expenses</td><td style={{ ...td, ...right, fontWeight: 700 }}>{money(f.totalOut)}</td></tr>
              </tbody>
            </table>}

        <h2 style={h2}>6. Pending collections carried forward</h2>
        <div style={hint}>What clients still owe as at {fmtDate(f.end)}. This is not part of {monthLabel(month)} revenue — each amount counts as revenue in the month it is received.</div>
        {f.pendingRows.length === 0
          ? <div style={{ ...hint, color: '#0B6E4F', fontWeight: 700 }}>Nothing pending — every case is fully paid.</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cfd8dc' }}>
              <thead><tr><th style={th}>Client</th><th style={{ ...th, ...right }}>Total fee</th><th style={{ ...th, ...right }}>Received</th><th style={{ ...th, ...right }}>Still owed</th><th style={th}>Expected on</th></tr></thead>
              <tbody>
                {f.pendingRows.map(r => (
                  <tr key={r.caseRec.id}>
                    <td style={td}>{r.caseRec.name}<div style={{ fontSize: 12.5, color: '#5B6270' }}>{r.caseRec.destination} · {r.caseRec.status} · open {r.ageDays} days</div></td>
                    <td style={{ ...td, ...right }}>{money(r.total)}</td>
                    <td style={{ ...td, ...right }}>{money(r.received)}</td>
                    <td style={{ ...td, ...right, fontWeight: 700, color: '#B5433A' }}>{money(r.outstanding)}</td>
                    <td style={td}>
                      <input type="date" value={r.caseRec.expectedPaymentDate || ''} onChange={e => setExpectedDate(r.caseRec.id, e.target.value)}
                        style={{ fontSize: 14, padding: '6px 8px', border: '1px solid #b8c4c0', borderRadius: 6, fontFamily: ARIAL }} />
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#F2F8F5' }}><td style={{ ...td, fontWeight: 700 }}>Total still to collect</td><td style={td} /><td style={td} /><td style={{ ...td, ...right, fontWeight: 700 }}>{money(f.pendingTotal)}</td><td style={td} /></tr>
              </tbody>
            </table>}

        <h2 style={h2}>Notes</h2>
        {closing
          ? <div style={{ fontSize: 15, minHeight: 28, whiteSpace: 'pre-wrap' }}>{closing.note || '—'}</div>
          : <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Anything worth remembering about this month…" style={{ width: '100%', fontSize: 15, padding: 10, border: '1px solid #b8c4c0', borderRadius: 6, fontFamily: ARIAL }} />}

        <div className="avoid-break" style={{ display: 'flex', gap: 48, margin: '44px 0 8px' }}>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>PREPARED BY</div>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>APPROVED BY (CEO)</div>
        </div>
      </div>
    </>
  );
}
