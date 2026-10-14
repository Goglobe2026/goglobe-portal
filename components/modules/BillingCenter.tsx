'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { caseCharge, casePaid, caseForTx, CLIENT_PAYMENT_CATEGORIES, daysBetween, closedOn } from '@/lib/finance';
import { caseDue, forecast, describeChunk, type DueState } from '@/lib/paymentPlan';
import { ARIAL, NAVY, th, td, R, inputStyle, waLink } from '@/components/ui/docStyles';

type State = Exclude<DueState, 'Settled'>;
const cl = (n: number) => `${n} client${n === 1 ? '' : 's'}`;
const STATE_COLOR: Record<State, string> = { Overdue: '#B5433A', 'Due this week': '#8a5a12', Promised: '#1F6E8C', 'No date set': '#5B6270' };

export function BillingCenter() {
  const { cases, setCases, transactions, team, logActivity, appointments } = useAppData();
  const toast = useToast();
  const todayStr = today();
  const [filter, setFilter] = useState<'All' | State>('All');
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');

  const lastPay = (caseId: string) => transactions
    .filter(t => t.type === 'Income' && CLIENT_PAYMENT_CATEGORIES.includes(t.category) && caseForTx(t, cases)?.id === caseId)
    .map(t => t.date).sort().pop() || '';

  const all = cases.filter(c => caseCharge(c) - casePaid(c) > 0).map(c => {
    const cd = caseDue(c, appointments, todayStr);
    const outstanding = cd.outstanding;
    const exp = cd.nextDue || (c.plan?.length ? '' : c.expectedPaymentDate || '');
    const state = cd.state as State;
    return { c, cd, outstanding, exp, state, age: Math.max(0, daysBetween(closedOn(c), todayStr)), last: lastPay(c.id) };
  });
  const open = all.filter(r => showClosed || (r.c.status !== 'Refused' && r.c.status !== 'Closed'));
  const sum = (rows: typeof open) => rows.reduce((s, r) => s + r.outstanding, 0);
  const by = (s: State) => open.filter(r => r.state === s);
  const month = todayStr.slice(0, 7);
  const collected = transactions.filter(t => t.type === 'Income' && CLIENT_PAYMENT_CATEGORIES.includes(t.category) && t.date.slice(0, 7) === month).reduce((s, t) => s + t.amount, 0);
  // Amounts by what is really due: a file paying in parts can be overdue on one part and not yet due on the next.
  const chunkSum = (pick: (x: { status: string; due: string }) => boolean) => open.reduce((t, r) => t + r.cd.chunks.filter(pick).reduce((a, x) => a + x.remaining, 0), 0);
  const chunkFiles = (pick: (x: { status: string; due: string }) => boolean) => open.filter(r => r.cd.chunks.some(pick)).length;
  const isOverdue = (x: { status: string }) => x.status === 'Overdue';
  const isSoon = (x: { status: string }) => x.status === 'Due soon';
  const isUndated = (x: { due: string }) => !x.due;
  const fc = forecast(open.map(r => ({ c: r.c })), appointments, todayStr, { monthsAhead: 3 });
  const rows = open.filter(r => (filter === 'All' || r.state === filter) && (!search.trim() || r.c.name.toLowerCase().includes(search.trim().toLowerCase())))
    .sort((a, b) => (a.state === 'Overdue' ? 0 : 1) - (b.state === 'Overdue' ? 0 : 1) || b.outstanding - a.outstanding);
  const buckets = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['Over 90 days', 91, 99999]] as const;

  // The date typed here belongs to the next part still owed on a plan, or to the file's one balance if it has no plan.
  function setDate(r: (typeof rows)[number], date: string) {
    const next = r.cd.next;
    setCases(prev => prev.map(c => {
      if (c.id !== r.c.id) return c;
      if (c.plan?.length && next && next.part !== undefined && c.plan[next.part]) return { ...c, plan: c.plan.map((p, i) => (i === next.part ? { ...p, dueDate: date || undefined } : p)) };
      return { ...c, expectedPaymentDate: date };
    }));
  }
  function remind(r: (typeof rows)[number]) {
    const dueNow = r.cd.overdue || r.cd.next?.remaining || r.outstanding;
    const msg = `Assalam o Alaikum ${r.c.name}, this is GoGlobe Consultant. ${r.c.plan?.length && r.cd.next ? `The next part of your payment (${r.cd.next.label}) for your ${r.c.destination} visa file, PKR ${Math.round(dueNow).toLocaleString()}, is ${r.cd.next.status === 'Overdue' ? 'now due' : 'pending'}${r.exp ? ` (${r.cd.next.status === 'Overdue' ? 'it was due' : 'expected'} on ${fmtDate(r.exp)})` : ''}.` : `A balance of PKR ${r.outstanding.toLocaleString()} for your ${r.c.destination} visa file is pending${r.exp ? ` (expected on ${fmtDate(r.exp)})` : ''}.`} Please arrange the payment to our official company account only and share the confirmation here. Thank you.`;
    window.open(waLink(r.c.phone, msg), '_blank');
    setCases(prev => prev.map(c => c.id === r.c.id ? { ...c, lastReminderDate: todayStr, reminderCount: (c.reminderCount || 0) + 1 } : c));
    logActivity(`Payment reminder sent — ${r.c.name}, ${money(r.outstanding)}`);
    toast('WhatsApp opened — press Send to deliver the reminder');
  }
  const chips: ('All' | State)[] = ['All', 'Overdue', 'Due this week', 'No date set', 'Promised'];
  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          ['Total still owed', money(sum(open)), cl(open.length), NAVY],
          ['Overdue', money(chunkSum(isOverdue)), `${cl(chunkFiles(isOverdue))} past their date`, '#B5433A'],
          ['Due this week', money(chunkSum(isSoon)), cl(chunkFiles(isSoon)), '#8a5a12'],
          ['No date promised', money(chunkSum(isUndated)), `${cl(chunkFiles(isUndated))} — ask for a date`, '#5B6270'],
          ['Collected this month', money(collected), 'client payments received', '#0B6E4F'],
        ].map(([a, b, c, col]) => (
          <div key={a} className="card"><div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>{a}</div><div style={{ fontSize: 22, fontWeight: 700, color: col }}>{b}</div><div style={{ fontSize: 13, color: '#5B6270' }}>{c}</div></div>
        ))}
      </div>

      <div className="card mb-4" data-testid="forecast">
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 2 }}>What is coming in — by the date each part falls due</div>
        <div style={{ fontSize: 13, color: '#5B6270', marginBottom: 10, lineHeight: 1.5 }}>Clients who pay in parts (half now, half at the appointment) are counted part by part, on the date each part is due. Money received always settles the oldest unpaid part first.</div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          {[fc.overdue, ...fc.months, fc.later, fc.undated].map(b => {
            const col = b.key === 'overdue' ? '#B5433A' : b.key === 'undated' ? '#5B6270' : NAVY;
            return (
              <div key={b.key} data-testid={`fc-${b.key}`} style={{ border: '1px solid #DCE5E0', borderRadius: 10, padding: '10px 12px', background: b.key === 'overdue' && b.amount ? '#FCEEEC' : '#F7F9FA' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5B6270' }}>{b.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: col }}>{money(b.amount)}</div>
                <div style={{ fontSize: 12, color: '#5B6270' }}>{b.files ? cl(b.files) : '—'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mb-4" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>How old are the balances?</th><th style={{ ...th, ...R }}>Clients</th><th style={{ ...th, ...R }}>Amount owed</th></tr></thead>
          <tbody>{buckets.map(([label, lo, hi]) => { const b = open.filter(r => r.age >= lo && r.age <= hi); return (
            <tr key={label}><td style={td}>{label} <span style={{ fontSize: 12.5, color: '#5B6270' }}>since the case was opened</span></td><td style={{ ...td, ...R }}>{b.length}</td><td style={{ ...td, ...R, fontWeight: 700 }}>{money(sum(b))}</td></tr>); })}</tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        {chips.map(k => <button key={k} className="btn" onClick={() => setFilter(k)} style={{ fontSize: 14.5, padding: '8px 14px', fontWeight: 700, background: filter === k ? NAVY : '#fff', color: filter === k ? '#fff' : NAVY, borderColor: filter === k ? NAVY : '#DCE5E0' }}>{k}{k !== 'All' ? ` (${by(k).length})` : ''}</button>)}
        <input placeholder="Search client…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 220 }} />
        <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} style={{ width: 'auto' }} /> Include refused / closed cases</label>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {rows.length === 0 ? <div style={{ padding: 22, fontSize: 15.5, color: '#0B6E4F', fontWeight: 700 }}>Nothing to chase here.</div> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Client</th><th style={{ ...th, ...R }}>Still owed</th><th style={th}>Status</th><th style={th}>Next part due</th><th style={th}>Reminders</th><th style={th}></th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.c.id} data-testid={`bill-${r.c.id}`} data-state={r.state}>
                <td style={td}><b>{r.c.name}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{r.c.destination} · {team.find(t => t.id === r.c.consultant)?.name || 'Unassigned'} · open {r.age} days{r.last ? ` · last paid ${fmtDate(r.last)}` : ' · nothing paid yet'}</div></td>
                <td style={{ ...td, ...R, fontWeight: 700 }}>{money(r.outstanding)}<div style={{ fontSize: 12.5, fontWeight: 400, color: '#5B6270' }}>of {money(caseCharge(r.c))}</div></td>
                <td style={td}><span style={{ fontWeight: 700, color: STATE_COLOR[r.state] }}>{r.state}</span>
                  {r.cd.overdue > 0 && r.cd.overdue < r.outstanding && <div style={{ fontSize: 12.5, color: '#B5433A' }}>{money(r.cd.overdue)} of it is overdue</div>}</td>
                <td style={td}>
                  {r.c.plan?.length && r.cd.next && <div data-testid="bill-next" style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.35 }}>{describeChunk(r.cd.next)}{r.cd.chunks.length > 1 ? <span style={{ color: '#5B6270' }}> · then {r.cd.chunks.length - 1} more part{r.cd.chunks.length === 2 ? '' : 's'}</span> : null}</div>}
                  <input type="date" value={r.exp} onChange={e => setDate(r, e.target.value)} disabled={!!r.c.plan?.length && !(r.cd.next && r.cd.next.part !== undefined && !!r.c.plan[r.cd.next.part])} title={r.c.plan?.length && !(r.cd.next && r.cd.next.part !== undefined && r.c.plan[r.cd.next.part]) ? 'This part is not in the payment plan yet — add it in the case file' : undefined} style={{ ...inputStyle, width: 160, fontSize: 14 }} />
                </td>
                <td style={{ ...td, fontSize: 14 }}>{r.c.reminderCount ? `${r.c.reminderCount} sent · last ${fmtDate(r.c.lastReminderDate || '')}` : <span style={{ color: '#93AC9F' }}>None yet</span>}</td>
                <td style={{ ...td, ...R }}><button className="btn btn-sm btn-primary" style={{ fontSize: 14 }} onClick={() => remind(r)}>WhatsApp reminder</button></td>
              </tr>))}</tbody>
          </table>}
      </div>
      <div style={{ fontSize: 14, color: '#5B6270', marginTop: 10, lineHeight: 1.6 }}>When a client pays, record it on their case (or mark the invoice paid) — the balance here updates by itself. Reminders always tell the client to pay the official company account only.</div>
    </div>
  );
}
