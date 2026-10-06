'use client';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { Modal, ModalTitle, ModalFoot } from '@/components/ui/Primitives';
import { overallPaid } from './Cases';
import { LOGO_FULL } from '@/lib/logo';
import { printSheet } from '@/lib/printSheet';
import { rupeesInWords } from '@/lib/moneyWords';
import { monthLabel, shiftMonth, monthEnd } from '@/lib/finance';
import { exportToCsv } from '@/lib/csv';
import type { TeamMember, PayrollCategory, PayRun, PayrollLine, PayLineItem, PayAttendance, StaffAdvance, Transaction, AttendanceRecord } from '@/lib/types';

const ARIAL = 'Arial, Helvetica, sans-serif';
const NAVY = '#14213D';
const th: CSSProperties = { background: NAVY, color: '#fff', padding: '11px 13px', fontSize: 14, fontWeight: 700, textAlign: 'left', fontFamily: ARIAL };
const td: CSSProperties = { padding: '11px 13px', fontSize: 15, borderBottom: '1px solid #e3e8ea', fontFamily: ARIAL, verticalAlign: 'middle' };
const R: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
const inputStyle: CSSProperties = { fontSize: 15, padding: '8px 10px', border: '1px solid #b8c4c0', borderRadius: 8, fontFamily: ARIAL, width: '100%' };
const lbl: CSSProperties = { fontSize: 13.5, fontWeight: 700, color: '#3A4A68', margin: '10px 0 4px', display: 'block' };

export const DEFAULT_PAYROLL_CATEGORIES: PayrollCategory[] = [
  { id: 'cat_basic', name: 'Basic salary', kind: 'Earning', mode: 'Fixed', posting: 'Salary', active: true, builtin: true },
  { id: 'cat_allow', name: 'Monthly allowance', kind: 'Earning', mode: 'Fixed', posting: 'Salary', active: true, builtin: true },
  { id: 'cat_comm', name: 'Commission', kind: 'Earning', mode: 'Variable', posting: 'Commission', active: true, builtin: true },
  { id: 'cat_bonus', name: 'Closed-case bonus', kind: 'Earning', mode: 'Variable', posting: 'Bonus', active: true, builtin: true },
  { id: 'cat_appr', name: 'Appreciation', kind: 'Earning', mode: 'Variable', posting: 'Appreciation', active: true, builtin: true },
  { id: 'cat_ot', name: 'Overtime', kind: 'Earning', mode: 'Variable', posting: 'Salary', active: true },
  { id: 'cat_transport', name: 'Transport allowance', kind: 'Earning', mode: 'Fixed', posting: 'Salary', active: true },
  { id: 'cat_medical', name: 'Medical allowance', kind: 'Earning', mode: 'Fixed', posting: 'Salary', active: true },
  { id: 'cat_fine', name: 'Fines', kind: 'Deduction', mode: 'Variable', posting: 'Salary', active: true, builtin: true },
  { id: 'cat_absence', name: 'Absence deduction', kind: 'Deduction', mode: 'Variable', posting: 'Salary', active: true, builtin: true },
  { id: 'cat_advance', name: 'Advance recovery', kind: 'Deduction', mode: 'Variable', posting: 'Salary', active: true, builtin: true },
  { id: 'cat_tax', name: 'Income tax', kind: 'Deduction', mode: 'Fixed', posting: 'Salary', active: true },
  { id: 'cat_pf', name: 'Provident fund', kind: 'Deduction', mode: 'Fixed', posting: 'Salary', active: true },
  { id: 'cat_eobi', name: 'EOBI', kind: 'Deduction', mode: 'Fixed', posting: 'Salary', active: true },
];

export const lineGross = (l: PayrollLine) => l.items.filter(i => i.kind === 'Earning').reduce((s, i) => s + i.amount, 0);
export const lineDed = (l: PayrollLine) => l.items.filter(i => i.kind === 'Deduction').reduce((s, i) => s + i.amount, 0);
export const lineNet = (l: PayrollLine) => lineGross(l) - lineDed(l);
const runTotals = (r: PayRun) => r.lines.reduce((a, l) => ({ gross: a.gross + lineGross(l), ded: a.ded + lineDed(l), net: a.net + lineNet(l), paid: a.paid + (l.paid ? lineNet(l) : 0) }), { gross: 0, ded: 0, net: 0, paid: 0 });

// Mon–Sat working week. Attendance is shown to help you decide on deductions;
// it never deducts anything by itself.
function attendanceFor(t: TeamMember, month: string, attendance: AttendanceRecord[], todayStr: string): PayAttendance {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  let workingDays = 0; let elapsedDays = 0;
  for (let d = 1; d <= days; d++) {
    if (new Date(y, m - 1, d).getDay() === 0) continue;
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    workingDays++;
    if (iso <= todayStr && iso <= monthEnd(month) && (!t.contractStart || iso >= t.contractStart)) elapsedDays++;
  }
  const recs = attendance.filter(a => a.staffId === t.id && a.date.slice(0, 7) === month);
  const leave = recs.filter(a => a.onApprovedLeave).length;
  const present = recs.filter(a => a.checkIn && !a.onApprovedLeave).length;
  const absent = Math.max(0, elapsedDays - present - leave);
  return { workingDays, elapsedDays, present, leave, absent, suggestedDeduction: workingDays ? Math.round((t.salary / workingDays) * absent) : 0 };
}

export function Payroll() {
  const { payrollCategories, setPayrollCategories } = useAppData();
  const [tab, setTab] = useState<'run' | 'profiles' | 'categories' | 'advances' | 'reports'>('run');
  useEffect(() => { if (payrollCategories.length === 0) setPayrollCategories(DEFAULT_PAYROLL_CATEGORIES); }, [payrollCategories.length, setPayrollCategories]);
  const tabs: [typeof tab, string][] = [['run', 'Pay Run'], ['profiles', 'Pay Profiles'], ['categories', 'Pay Categories'], ['advances', 'Advances'], ['reports', 'Reports']];
  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="flex gap-2 flex-wrap mb-5" style={{ borderBottom: '1px solid #DCE5E0', paddingBottom: 12 }}>
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="btn"
            style={{ fontSize: 15, padding: '9px 18px', fontWeight: 700, background: tab === k ? NAVY : '#fff', color: tab === k ? '#fff' : NAVY, borderColor: tab === k ? NAVY : '#DCE5E0' }}>{label}</button>
        ))}
      </div>
      {tab === 'run' && <PayRunTab />}
      {tab === 'profiles' && <ProfilesTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'advances' && <AdvancesTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}

// ======================================================================
// PAY RUN
// ======================================================================
function PayRunTab() {
  const { team, setTeam, cases, transactions, setTransactions, adjustments, attendance, payrollCategories, payRuns, setPayRuns, staffAdvances, setStaffAdvances, logActivity } = useAppData();
  const toast = useToast();
  const todayStr = today();
  const [month, setMonth] = useState(shiftMonth(todayStr.slice(0, 7), -1));
  const [editId, setEditId] = useState<string | null>(null);
  const [slipId, setSlipId] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const run = payRuns.find(r => r.month === month);
  const otherOpen = payRuns.find(r => r.month !== month && r.status !== 'Paid');
  const cats = payrollCategories.length ? payrollCategories : DEFAULT_PAYROLL_CATEGORIES;

  function buildLine(t: TeamMember): PayrollLine {
    const cat = (id: string) => cats.find(c => c.id === id);
    const items: PayLineItem[] = [];
    const push = (categoryId: string, label: string, kind: 'Earning' | 'Deduction', amount: number, posting: string) => {
      const a = Math.round(amount); if (a > 0) items.push({ categoryId, label, kind, amount: a, posting, auto: true });
    };
    push('cat_basic', cat('cat_basic')?.name || 'Basic salary', 'Earning', t.salary, 'Salary');
    push('cat_allow', cat('cat_allow')?.name || 'Monthly allowance', 'Earning', t.monthlyAllowance || 0, 'Salary');
    (t.payItems || []).forEach(p => { const c = cat(p.categoryId); if (c && c.active) push(c.id, c.name, c.kind, p.amount, c.posting); });

    const mine = cases.filter(c => c.consultant === t.id);
    const won = mine.filter(c => c.status === 'Approved').length;
    const revenue = mine.reduce((s, c) => s + overallPaid(c), 0);
    const paidTx = (cat2: string) => transactions.filter(x => x.type === 'Expense' && x.category === cat2 && x.party === t.name).reduce((s, x) => s + x.amount, 0);
    const closedInMonth = mine.filter(c => c.status === 'Approved' && c.createdAt.slice(0, 7) === month).length;
    const quotaMet = t.department !== 'Sales' || closedInMonth >= (t.monthlyQuota || 5);
    push('cat_comm', 'Commission', 'Earning', quotaMet ? Math.max(0, Math.round(revenue * (t.commissionPercent / 100)) - paidTx('Commission')) : 0, 'Commission');
    push('cat_bonus', 'Closed-case bonus', 'Earning', Math.max(0, won * t.bonusPerClose - paidTx('Bonus')), 'Bonus');
    const adj = adjustments.filter(a => a.staffId === t.id && a.date.slice(0, 7) === month);
    push('cat_appr', 'Appreciation', 'Earning', adj.filter(a => a.type === 'Bonus').reduce((s, a) => s + a.amount, 0), 'Appreciation');
    // Absence fines are covered by the attendance suggestion, so they are left out here.
    push('cat_fine', 'Fines', 'Deduction', adj.filter(a => a.type === 'Fine' && !/^absent/i.test(a.reason)).reduce((s, a) => s + a.amount, 0), 'Salary');
    const adv = staffAdvances.filter(a => a.staffId === t.id && a.amount - a.recovered > 0)
      .reduce((s, a) => s + Math.min(a.monthlyRecovery || a.amount - a.recovered, a.amount - a.recovered), 0);
    push('cat_advance', 'Advance recovery', 'Deduction', adv, 'Salary');

    return {
      id: genId('pl'), staffId: t.id, staffName: t.name, role: t.role, employeeId: t.employeeId, department: t.department,
      bankName: t.bankName || '', accountNo: t.accountNo || '', items, attendance: attendanceFor(t, month, attendance, todayStr),
      slipNumber: '', paid: false, paidDate: '',
    };
  }

  function createRun() {
    if (run) return;
    if (otherOpen) { toast(`Finish ${monthLabel(otherOpen.month)} payroll first (${otherOpen.status}) — it has not been fully paid yet.`); return; }
    const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
    if (!staff.length) { toast('No active staff to pay'); return; }
    const r: PayRun = { id: genId('run'), month, status: 'Draft', createdDate: todayStr, approvedDate: '', paidDate: '', lines: staff.map(buildLine) };
    setPayRuns(prev => [...prev, r]);
    logActivity(`Pay run created — ${monthLabel(month)}, ${r.lines.length} staff`);
    toast(`Pay run created for ${monthLabel(month)}`);
  }
  function deleteDraft() {
    if (!run || run.status !== 'Draft') return;
    if (!window.confirm(`Delete the draft pay run for ${monthLabel(month)}? Any edits you made will be lost, and you can create it again.`)) return;
    setPayRuns(prev => prev.filter(r => r.id !== run.id));
  }
  function approve() {
    if (!run || run.status !== 'Draft') return;
    if (!window.confirm(`Approve ${monthLabel(month)} payroll?\n\nTotal net pay: ${money(runTotals(run).net)} for ${run.lines.length} staff.\nAfter approval the amounts are locked.`)) return;
    setPayRuns(prev => prev.map(r => r.id !== run.id ? r : { ...r, status: 'Approved', approvedDate: todayStr,
      lines: r.lines.map(l => ({ ...l, slipNumber: `PS-${month.replace('-', '')}-${l.employeeId}` })) }));
    logActivity(`Payroll approved — ${monthLabel(month)}`);
    toast('Payroll approved');
  }
  function pay(lineIds: string[]) {
    if (!run || run.status === 'Draft') return;
    const lines = run.lines.filter(l => lineIds.includes(l.id) && !l.paid);
    if (!lines.length) return;
    const newTx: Transaction[] = []; const recov: Record<string, number> = {};
    lines.forEach(l => {
      const by: Record<string, number> = { Salary: 0, Commission: 0, Bonus: 0, Appreciation: 0 };
      l.items.filter(i => i.kind === 'Earning').forEach(i => { by[i.posting] = (by[i.posting] || 0) + i.amount; });
      let ded = lineDed(l);
      // Deductions come out of the salary part first, then the other heads.
      for (const k of ['Salary', 'Commission', 'Bonus', 'Appreciation']) { const take = Math.min(by[k], ded); by[k] -= take; ded -= take; }
      Object.entries(by).forEach(([category, amount]) => {
        if (amount > 0) newTx.push({ id: genId('tx'), date: todayStr, type: 'Expense', category, party: l.staffName, amount, note: `Payroll ${monthLabel(run.month)} — ${l.slipNumber}` });
      });
      const rec = l.items.find(i => i.categoryId === 'cat_advance'); if (rec) recov[l.staffId] = rec.amount;
    });
    setTransactions(prev => [...prev, ...newTx]);
    if (Object.keys(recov).length) setStaffAdvances(prev => prev.map(a => {
      const left = recov[a.staffId]; if (!left) return a;
      const take = Math.min(left, a.amount - a.recovered); if (take <= 0) return a;
      recov[a.staffId] = left - take; return { ...a, recovered: a.recovered + take };
    }));
    setTeam(prev => prev.map(t => lines.some(l => l.staffId === t.id) ? { ...t, lastSalaryPaid: todayStr } : t));
    setPayRuns(prev => prev.map(r => {
      if (r.id !== run.id) return r;
      const ls = r.lines.map(l => lineIds.includes(l.id) && !l.paid ? { ...l, paid: true, paidDate: todayStr } : l);
      const all = ls.every(l => l.paid);
      return { ...r, lines: ls, status: all ? 'Paid' : r.status, paidDate: all ? todayStr : r.paidDate };
    }));
    const total = lines.reduce((s, l) => s + lineNet(l), 0);
    logActivity(`Payroll paid — ${lines.length} staff, ${money(total)} (${monthLabel(run.month)})`);
    toast(`Paid ${lines.length} staff — ${money(total)} recorded in Accounts`);
  }

  const T = run ? runTotals(run) : null;
  const statusColor = run?.status === 'Paid' ? '#0B6E4F' : run?.status === 'Approved' ? '#1F6E8C' : '#8a5a12';
  const btn: CSSProperties = { fontSize: 15, padding: '10px 18px' };
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button className="btn" style={btn} onClick={() => setMonth(shiftMonth(month, -1))}>‹ Earlier</button>
          <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, minWidth: 190, textAlign: 'center' }}>{monthLabel(month)}</div>
          <button className="btn" style={btn} disabled={month >= todayStr.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}>Later ›</button>
          {run && <span style={{ marginLeft: 8, padding: '5px 12px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, color: statusColor, background: '#F2F8F5', border: `1px solid ${statusColor}` }}>{run.status.toUpperCase()}</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!run && <button className="btn btn-primary" style={btn} onClick={createRun}>Create pay run for {monthLabel(month)}</button>}
          {run?.status === 'Draft' && <><button className="btn" style={btn} onClick={deleteDraft}>Delete draft</button><button className="btn btn-primary" style={btn} onClick={approve}>Approve payroll</button></>}
          {run && run.status !== 'Draft' && <>
            <button className="btn" style={btn} onClick={() => setBulk(true)}>Print all payslips</button>
            {run.status === 'Approved' && <button className="btn btn-primary" style={btn} onClick={() => pay(run.lines.map(l => l.id))}>Pay all staff</button>}
          </>}
        </div>
      </div>

      {!run && (
        <div className="card" style={{ fontSize: 15.5, lineHeight: 1.7 }}>
          <b>No pay run for {monthLabel(month)} yet.</b> Creating one calculates every staff member automatically: basic salary, allowances and any recurring items from their Pay Profile, plus commission, bonus, appreciation, fines and advance recovery. You then review, add anything extra such as overtime, approve, and pay.
          {otherOpen && <div style={{ color: '#B5433A', marginTop: 8 }}>{monthLabel(otherOpen.month)} payroll is still {otherOpen.status.toLowerCase()} — finish paying it before starting another month.</div>}
        </div>
      )}

      {run && T && (
        <>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[['Staff on this run', String(run.lines.length), ''], ['Gross earnings', money(T.gross), ''], ['Deductions', money(T.ded), ''], ['Net payable', money(T.net), `Paid so far: ${money(T.paid)}`]].map(([a, b, c]) => (
              <div key={a} className="card"><div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>{a}</div><div style={{ fontSize: 24, fontWeight: 700, color: NAVY }}>{b}</div><div style={{ fontSize: 13, color: '#5B6270' }}>{c}</div></div>
            ))}
          </div>
          <div className="card p-0 overflow-auto" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Employee</th><th style={{ ...th, ...R }}>Earnings</th><th style={{ ...th, ...R }}>Deductions</th><th style={{ ...th, ...R }}>Net pay</th><th style={th}>Status</th><th style={th}></th></tr></thead>
              <tbody>
                {run.lines.map(l => (
                  <tr key={l.id}>
                    <td style={td}><b>{l.staffName}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{l.role} · {l.employeeId}</div>
                      {run.status === 'Draft' && l.attendance.absent > 0 && <div style={{ fontSize: 12.5, color: '#8a5a12' }}>{l.attendance.absent} day{l.attendance.absent === 1 ? '' : 's'} without attendance</div>}</td>
                    <td style={{ ...td, ...R }}>{money(lineGross(l))}</td>
                    <td style={{ ...td, ...R, color: lineDed(l) ? '#B5433A' : undefined }}>{lineDed(l) ? '− ' + money(lineDed(l)) : '—'}</td>
                    <td style={{ ...td, ...R, fontWeight: 700 }}>{money(lineNet(l))}</td>
                    <td style={td}>{l.paid ? <span style={{ color: '#0B6E4F', fontWeight: 700 }}>Paid {fmtDate(l.paidDate)}</span> : <span style={{ color: statusColor, fontWeight: 700 }}>{run.status === 'Draft' ? 'Draft' : 'To pay'}</span>}</td>
                    <td style={{ ...td, ...R }}>
                      <div className="flex gap-1.5 justify-end">
                        {run.status === 'Draft' && <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => setEditId(l.id)}>Review / edit</button>}
                        {run.status !== 'Draft' && <button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => setSlipId(l.id)}>Payslip</button>}
                        {run.status === 'Approved' && !l.paid && <button className="btn btn-sm btn-primary" style={{ fontSize: 14 }} onClick={() => pay([l.id])}>Pay</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#F2F8F5' }}><td style={{ ...td, fontWeight: 700 }}>Total</td><td style={{ ...td, ...R, fontWeight: 700 }}>{money(T.gross)}</td><td style={{ ...td, ...R, fontWeight: 700 }}>− {money(T.ded)}</td><td style={{ ...td, ...R, fontWeight: 700 }}>{money(T.net)}</td><td style={td} colSpan={2} /></tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 14, color: '#5B6270', marginTop: 10, lineHeight: 1.6 }}>
            Paying a staff member records their salary, commission, bonus and appreciation as separate expenses in Accounts, so Monthly Closing picks them up automatically. Fines and advance recovery reduce what is paid out.
          </div>
        </>
      )}

      <Modal open={!!editId} onClose={() => setEditId(null)} wide>
        {editId && run && <LineEditor run={run} lineId={editId} cats={cats} onClose={() => setEditId(null)} />}
      </Modal>
      <Modal open={!!slipId} onClose={() => setSlipId(null)} wide>
        {slipId && run && <PayslipView run={run} line={run.lines.find(l => l.id === slipId)!} onClose={() => setSlipId(null)} />}
      </Modal>
      <Modal open={bulk} onClose={() => setBulk(false)} wide>
        {bulk && run && <BulkPayslips run={run} onClose={() => setBulk(false)} />}
      </Modal>
    </>
  );
}

function LineEditor({ run, lineId, cats, onClose }: { run: PayRun; lineId: string; cats: PayrollCategory[]; onClose: () => void }) {
  const { setPayRuns, logActivity } = useAppData();
  const line = run.lines.find(l => l.id === lineId)!;
  const [items, setItems] = useState<PayLineItem[]>(line.items.map(i => ({ ...i })));
  const [addId, setAddId] = useState('');
  const [addAmt, setAddAmt] = useState('');
  const gross = items.filter(i => i.kind === 'Earning').reduce((s, i) => s + i.amount, 0);
  const ded = items.filter(i => i.kind === 'Deduction').reduce((s, i) => s + i.amount, 0);
  const a = line.attendance;
  const usable = cats.filter(c => c.active && !c.builtin || c.id === 'cat_absence');

  function setAmount(idx: number, v: number) { setItems(prev => prev.map((i, k) => k === idx ? { ...i, amount: Math.max(0, Math.round(v) || 0) } : i)); }
  function addItem() {
    const c = cats.find(x => x.id === addId); const amt = Math.round(Number(addAmt));
    if (!c || !(amt > 0)) return;
    setItems(prev => [...prev, { categoryId: c.id, label: c.name, kind: c.kind, amount: amt, posting: c.posting, auto: false }]);
    setAddId(''); setAddAmt('');
  }
  function applySuggested() {
    if (!a.suggestedDeduction) return;
    const c = cats.find(x => x.id === 'cat_absence');
    setItems(prev => [...prev.filter(i => i.categoryId !== 'cat_absence'), { categoryId: 'cat_absence', label: c?.name || 'Absence deduction', kind: 'Deduction', amount: a.suggestedDeduction, posting: 'Salary', auto: false }]);
  }
  function save() {
    setPayRuns(prev => prev.map(r => r.id !== run.id ? r : { ...r, lines: r.lines.map(l => l.id === lineId ? { ...l, items: items.filter(i => i.amount > 0) } : l) }));
    logActivity(`Pay run edited — ${line.staffName}, ${monthLabel(run.month)}`);
    onClose();
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>Review pay — {line.staffName}</ModalTitle>
      <div style={{ fontSize: 14.5, color: '#5B6270', marginBottom: 10 }}>{line.role} · {monthLabel(run.month)}</div>
      <div className="card" style={{ background: '#F7F9FA', marginBottom: 12, fontSize: 14.5, lineHeight: 1.6 }}>
        <b>Attendance this month</b> (Mon–Sat): {a.present} present · {a.leave} on approved leave · <b style={{ color: a.absent ? '#B5433A' : '#0B6E4F' }}>{a.absent} without attendance</b> of {a.elapsedDays} working days so far.
        {a.absent > 0 && <div>Suggested deduction for those days: <b>{money(a.suggestedDeduction)}</b> <button className="btn btn-sm" style={{ marginLeft: 8, fontSize: 13.5 }} onClick={applySuggested}>Apply to this pay</button>
          <div style={{ fontSize: 13, color: '#5B6270' }}>Nothing is deducted unless you apply it — check the attendance records first.</div></div>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead><tr><th style={th}>Item</th><th style={th}>Type</th><th style={{ ...th, ...R, width: 170 }}>Amount (PKR)</th><th style={th}></th></tr></thead>
        <tbody>
          {items.map((i, k) => (
            <tr key={k}>
              <td style={td}>{i.label}{i.auto && <span style={{ fontSize: 12, color: '#5B6270' }}> · automatic</span>}</td>
              <td style={{ ...td, color: i.kind === 'Earning' ? '#0B6E4F' : '#B5433A' }}>{i.kind}</td>
              <td style={td}><input type="number" value={i.amount} onChange={e => setAmount(k, Number(e.target.value))} style={{ ...inputStyle, textAlign: 'right' }} /></td>
              <td style={td}><button className="btn btn-sm btn-ghost btn-danger" onClick={() => setItems(prev => prev.filter((_, j) => j !== k))}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 items-end mb-3 flex-wrap">
        <div style={{ flex: 2, minWidth: 200 }}><label style={lbl}>Add an item</label>
          <select value={addId} onChange={e => setAddId(e.target.value)} style={inputStyle}>
            <option value="">Choose a category…</option>
            {usable.map(c => <option key={c.id} value={c.id}>{c.name} ({c.kind.toLowerCase()})</option>)}
          </select></div>
        <div style={{ flex: 1, minWidth: 120 }}><label style={lbl}>Amount</label><input type="number" value={addAmt} onChange={e => setAddAmt(e.target.value)} style={inputStyle} /></div>
        <button className="btn" style={{ fontSize: 15, padding: '10px 16px' }} onClick={addItem}>Add</button>
      </div>
      <div className="card" style={{ background: '#FBF0DD' }}>
        <div className="flex justify-between" style={{ fontSize: 15 }}><span>Earnings</span><b>{money(gross)}</b></div>
        <div className="flex justify-between" style={{ fontSize: 15 }}><span>Deductions</span><b style={{ color: '#B5433A' }}>− {money(ded)}</b></div>
        <div className="flex justify-between" style={{ fontSize: 20, marginTop: 4 }}><span><b>Net pay</b></span><b style={{ color: '#0B6E4F' }}>{money(gross - ded)}</b></div>
      </div>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></ModalFoot>
    </div>
  );
}

// ======================================================================
// PAYSLIPS
// ======================================================================
function PayslipSheet({ run, line }: { run: PayRun; line: PayrollLine }) {
  const earn = line.items.filter(i => i.kind === 'Earning'); const ded = line.items.filter(i => i.kind === 'Deduction');
  const net = lineNet(line);
  const cell: CSSProperties = { border: '1px solid #cfd8dc', padding: '3px 12px', fontSize: 14.5, fontFamily: ARIAL };
  const head: CSSProperties = { ...cell, background: NAVY, color: '#fff', fontWeight: 700, fontSize: 14 };
  const sec: CSSProperties = { fontWeight: 700, fontSize: 16, color: NAVY, marginBottom: 6, fontFamily: ARIAL };
  const table = (rows: PayLineItem[], total: number, label: string, neg = false) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
      <thead><tr><th style={{ ...head, textAlign: 'left' }}>Description</th><th style={{ ...head, textAlign: 'right', width: 190 }}>Amount (PKR)</th></tr></thead>
      <tbody>
        {rows.map((i, k) => <tr key={k}><td style={cell}>{i.label}</td><td style={{ ...cell, textAlign: 'right', color: neg ? '#B5433A' : undefined }}>{neg ? '− ' : ''}{i.amount.toLocaleString()}</td></tr>)}
        <tr><td style={{ ...cell, fontWeight: 700, background: '#F7F9FA' }}>{label}</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700, background: '#F7F9FA' }}>{neg ? '− ' : ''}{total.toLocaleString()}</td></tr>
      </tbody>
    </table>
  );
  return (
    <div style={{ background: '#fff', color: '#1a1a1a', fontFamily: ARIAL, padding: 4 }}>
      <div className="avoid-break" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <img src={LOGO_FULL} style={{ height: 52 }} alt="GoGlobe Consultant" />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: NAVY }}>PAYSLIP</div>
          <div style={{ fontSize: 15 }}><b>Pay period:</b> {monthLabel(run.month)}</div>
          <div style={{ fontSize: 15 }}><b>Slip No:</b> {line.slipNumber}</div>
        </div>
      </div>
      <div style={{ height: 5, background: 'linear-gradient(90deg,#1FA463,#1F6E8C,#14213D)', marginBottom: 14 }} />
      <div className="avoid-break" style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div style={{ flex: 1, background: '#F2F8F5', padding: 10, fontSize: 14.5, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 2 }}>EMPLOYEE</div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{line.staffName}</div>
          <div>{line.role}</div>
          <div>ID: {line.employeeId} · {line.department}</div>
        </div>
        <div style={{ flex: 1, background: '#F2F8F5', padding: 10, fontSize: 14.5, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 2 }}>PAYMENT</div>
          <div>Status: <b style={{ color: line.paid ? '#0B6E4F' : '#B5433A' }}>{line.paid ? 'PAID' : 'NOT PAID YET'}</b></div>
          <div>{line.paid ? `Paid on ${fmtDate(line.paidDate)}` : 'Payment date to be recorded'}</div>
          {(line.bankName || line.accountNo) && <div>{line.bankName} {line.accountNo}</div>}
        </div>
      </div>
      <div className="avoid-break"><div style={sec}>EARNINGS</div>{table(earn, lineGross(line), 'Gross earnings')}</div>
      {ded.length > 0 && <div className="avoid-break"><div style={sec}>DEDUCTIONS</div>{table(ded, lineDed(line), 'Total deductions', true)}</div>}
      <div className="avoid-break" style={{ background: '#FBF0DD', border: '1px solid #E8C784', padding: '10px 18px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: NAVY }}>NET PAY</div>
          <div style={{ fontWeight: 700, fontSize: 30, color: '#0B6E4F' }}>PKR {net.toLocaleString()}</div>
        </div>
        <div style={{ fontSize: 14.5, marginTop: 6, color: '#444' }}>{rupeesInWords(net)}</div>
      </div>
      <div className="avoid-break" style={{ display: 'flex', gap: 48, margin: '14px 0 8px' }}>
        <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>EMPLOYEE SIGNATURE</div>
        <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 6, fontSize: 14 }}>AUTHORIZED SIGNATURE / COMPANY STAMP</div>
      </div>
      <div style={{ fontSize: 12.5, color: '#666', marginBottom: 8 }}>This is a computer-generated payslip issued by GoGlobe Consultant.</div>
      <div className="avoid-break" style={{ background: NAVY, color: '#fff', padding: '9px 16px', fontSize: 13, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <div><b>WhatsApp</b><br />0317-9911228 | 0327-9911228</div><div><b>PTCL</b><br />051-6126833</div>
        <div><b>Email</b><br />info@goglobeconsultants.com</div><div><b>Website</b><br />goglobeconsultants.com</div>
      </div>
    </div>
  );
}

function PayslipView({ run, line, onClose, onBack }: { run: PayRun; line: PayrollLine; onClose?: () => void; onBack?: () => void }) {
  return (
    <>
      <div className="no-print flex items-center justify-between mb-3.5">
        {onBack ? <button className="btn btn-sm" onClick={onBack}>← All payslips</button> : <button className="btn btn-sm" onClick={onClose}>Close</button>}
        <button className="btn btn-sm btn-primary" onClick={printSheet}>Print / Save as PDF</button>
      </div>
      <div id="invoice-print-area"><PayslipSheet run={run} line={line} /></div>
    </>
  );
}

function BulkPayslips({ run, onClose }: { run: PayRun; onClose: () => void }) {
  return (
    <>
      <div className="no-print flex items-center justify-between mb-3.5">
        <div><b style={{ fontSize: 16 }}>{monthLabel(run.month)} — all payslips</b><div style={{ fontSize: 13.5, color: '#5B6270' }}>{run.lines.length} payslips, one per page when printed</div></div>
        <div className="flex gap-2"><button className="btn btn-sm" onClick={onClose}>Close</button><button className="btn btn-sm btn-primary" onClick={printSheet}>Print / Save as PDF</button></div>
      </div>
      <div id="invoice-print-area">
        {run.lines.map((l, k) => (
          <div key={l.id} style={{ breakAfter: k < run.lines.length - 1 ? 'page' : 'auto', pageBreakAfter: k < run.lines.length - 1 ? 'always' : 'auto' }}>
            <PayslipSheet run={run} line={l} />
          </div>
        ))}
      </div>
    </>
  );
}

export function PayslipHistory({ staff, onClose }: { staff: TeamMember; onClose: () => void }) {
  const { payRuns } = useAppData();
  const [open, setOpen] = useState<{ run: PayRun; line: PayrollLine } | null>(null);
  const mine = payRuns.filter(r => r.status !== 'Draft').flatMap(r => r.lines.filter(l => l.staffId === staff.id).map(l => ({ run: r, line: l }))).sort((a, b) => b.run.month.localeCompare(a.run.month));
  if (open) return <PayslipView run={open.run} line={open.line} onBack={() => setOpen(null)} />;
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>Payslips — {staff.name}</ModalTitle>
      {mine.length === 0
        ? <div style={{ fontSize: 15, color: '#5B6270', marginBottom: 14 }}>No payslip yet. Payslips appear here once a pay run is approved (HR → Payroll).</div>
        : <div className="flex flex-col gap-2 mb-4">{mine.map(({ run, line }) => (
            <button key={line.id} className="btn text-left flex items-center justify-between" style={{ fontSize: 15, padding: '12px 14px' }} onClick={() => setOpen({ run, line })}>
              <span><b>{monthLabel(run.month)}</b> · {line.slipNumber}</span>
              <span>{money(lineNet(line))} <b style={{ color: line.paid ? '#0B6E4F' : '#B5433A' }}>{line.paid ? `Paid ${fmtDate(line.paidDate)}` : 'Not paid yet'}</b></span>
            </button>))}</div>}
      <ModalFoot><button className="btn" onClick={onClose}>Close</button></ModalFoot>
    </div>
  );
}

// ======================================================================
// PAY PROFILES
// ======================================================================
function ProfilesTab() {
  const { team, payrollCategories } = useAppData();
  const [editId, setEditId] = useState<string | null>(null);
  const cats = payrollCategories.length ? payrollCategories : DEFAULT_PAYROLL_CATEGORIES;
  const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
  return (
    <>
      <div style={{ fontSize: 15, color: '#5B6270', marginBottom: 12, lineHeight: 1.6 }}>Each person’s fixed pay: basic salary, allowance, recurring items such as transport allowance or provident fund, and their bank details for transfers. The monthly pay run starts from this.</div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Employee</th><th style={{ ...th, ...R }}>Basic</th><th style={{ ...th, ...R }}>Allowance</th><th style={th}>Recurring items</th><th style={th}>Bank</th><th style={th}></th></tr></thead>
          <tbody>{staff.map(t => (
            <tr key={t.id}>
              <td style={td}><b>{t.name}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{t.role} · {t.department}</div></td>
              <td style={{ ...td, ...R }}>{money(t.salary)}</td>
              <td style={{ ...td, ...R }}>{money(t.monthlyAllowance || 0)}</td>
              <td style={{ ...td, fontSize: 14 }}>{(t.payItems || []).length ? (t.payItems || []).map(p => { const c = cats.find(x => x.id === p.categoryId); return `${c?.name || 'Item'} ${c?.kind === 'Deduction' ? '−' : '+'}${p.amount.toLocaleString()}`; }).join(' · ') : <span style={{ color: '#93AC9F' }}>None</span>}</td>
              <td style={{ ...td, fontSize: 14 }}>{t.bankName || t.accountNo ? `${t.bankName || ''} ${t.accountNo || ''}` : <span style={{ color: '#93AC9F' }}>Not added</span>}</td>
              <td style={{ ...td, ...R }}><button className="btn btn-sm" style={{ fontSize: 14 }} onClick={() => setEditId(t.id)}>Edit pay</button></td>
            </tr>))}</tbody>
        </table>
      </div>
      <Modal open={!!editId} onClose={() => setEditId(null)} wide>{editId && <ProfileEditor staff={team.find(t => t.id === editId)!} cats={cats} onClose={() => setEditId(null)} />}</Modal>
    </>
  );
}

function ProfileEditor({ staff: t, cats, onClose }: { staff: TeamMember; cats: PayrollCategory[]; onClose: () => void }) {
  const { setTeam, logActivity } = useAppData();
  const toast = useToast();
  const [salary, setSalary] = useState(String(t.salary)); const [allowance, setAllowance] = useState(String(t.monthlyAllowance || 0));
  const [bank, setBank] = useState(t.bankName || ''); const [acct, setAcct] = useState(t.accountNo || '');
  const [items, setItems] = useState<{ categoryId: string; amount: number }[]>((t.payItems || []).map(p => ({ ...p })));
  const [addId, setAddId] = useState(''); const [addAmt, setAddAmt] = useState('');
  const usable = cats.filter(c => c.active && !c.builtin && c.mode === 'Fixed' && !items.some(i => i.categoryId === c.id));
  function add() { const amt = Math.round(Number(addAmt)); if (!addId || !(amt > 0)) return; setItems(p => [...p, { categoryId: addId, amount: amt }]); setAddId(''); setAddAmt(''); }
  function save() {
    setTeam(prev => prev.map(x => x.id === t.id ? { ...x, salary: Number(salary) || 0, monthlyAllowance: Number(allowance) || 0, bankName: bank, accountNo: acct, payItems: items } : x));
    logActivity(`Pay profile updated — ${t.name}`); toast('Pay profile saved'); onClose();
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>Pay profile — {t.name}</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <div><label style={lbl}>Basic salary (PKR)</label><input type="number" value={salary} onChange={e => setSalary(e.target.value)} style={inputStyle} /></div>
        <div><label style={lbl}>Monthly allowance (PKR)</label><input type="number" value={allowance} onChange={e => setAllowance(e.target.value)} style={inputStyle} /></div>
        <div><label style={lbl}>Bank name</label><input value={bank} onChange={e => setBank(e.target.value)} style={inputStyle} placeholder="e.g. Meezan Bank" /></div>
        <div><label style={lbl}>Account number / IBAN</label><input value={acct} onChange={e => setAcct(e.target.value)} style={inputStyle} /></div>
      </div>
      <label style={{ ...lbl, marginTop: 16 }}>Recurring items (added to every pay run)</label>
      {items.length === 0 && <div style={{ fontSize: 14, color: '#5B6270', marginBottom: 6 }}>None yet.</div>}
      {items.map((i, k) => { const c = cats.find(x => x.id === i.categoryId); return (
        <div key={k} className="flex gap-2 items-center mb-1.5">
          <div style={{ flex: 2, fontSize: 15 }}>{c?.name || 'Item'} <span style={{ fontSize: 12.5, color: c?.kind === 'Deduction' ? '#B5433A' : '#0B6E4F' }}>({c?.kind.toLowerCase()})</span></div>
          <input type="number" value={i.amount} onChange={e => setItems(p => p.map((x, j) => j === k ? { ...x, amount: Number(e.target.value) } : x))} style={{ ...inputStyle, flex: 1, textAlign: 'right' }} />
          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setItems(p => p.filter((_, j) => j !== k))}>Remove</button>
        </div>); })}
      <div className="flex gap-2 items-end mt-2">
        <select value={addId} onChange={e => setAddId(e.target.value)} style={{ ...inputStyle, flex: 2 }}><option value="">Add a recurring item…</option>{usable.map(c => <option key={c.id} value={c.id}>{c.name} ({c.kind.toLowerCase()})</option>)}</select>
        <input type="number" placeholder="Amount" value={addAmt} onChange={e => setAddAmt(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button className="btn" style={{ fontSize: 15, padding: '9px 14px' }} onClick={add}>Add</button>
      </div>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save pay profile</button></ModalFoot>
    </div>
  );
}

// ======================================================================
// CATEGORIES
// ======================================================================
function CategoriesTab() {
  const { payrollCategories, setPayrollCategories, team, setTeam } = useAppData();
  const [showNew, setShowNew] = useState(false);
  const cats = payrollCategories.length ? payrollCategories : DEFAULT_PAYROLL_CATEGORIES;
  const toggle = (id: string) => setPayrollCategories(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  function remove(c: PayrollCategory) {
    if (!window.confirm(`Delete “${c.name}”? It will also be removed from staff pay profiles. Past pay runs keep their figures.`)) return;
    setPayrollCategories(prev => prev.filter(x => x.id !== c.id));
    setTeam(prev => prev.map(t => t.payItems?.some(p => p.categoryId === c.id) ? { ...t, payItems: t.payItems.filter(p => p.categoryId !== c.id) } : t));
  }
  const group = (kind: 'Earning' | 'Deduction') => (
    <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 18 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>{kind === 'Earning' ? 'Earnings' : 'Deductions'}</th><th style={th}>How it works</th>{kind === 'Earning' && <th style={th}>Recorded in Accounts as</th>}<th style={th}>Status</th><th style={th}></th></tr></thead>
        <tbody>{cats.filter(c => c.kind === kind).map(c => (
          <tr key={c.id} style={{ opacity: c.active ? 1 : .55 }}>
            <td style={td}><b>{c.name}</b>{c.builtin && <span style={{ fontSize: 12, color: '#5B6270' }}> · built in</span>}</td>
            <td style={{ ...td, fontSize: 14 }}>{c.builtin ? (c.id === 'cat_basic' || c.id === 'cat_allow' ? 'From the employee’s pay profile' : 'Calculated automatically each month') : c.mode === 'Fixed' ? 'Fixed — set per person in Pay Profiles' : 'Variable — added during the pay run'}</td>
            {kind === 'Earning' && <td style={td}>{c.posting}</td>}
            <td style={td}>{c.active ? 'Active' : 'Off'}</td>
            <td style={{ ...td, ...R }}>{!c.builtin && <div className="flex gap-1.5 justify-end"><button className="btn btn-sm" onClick={() => toggle(c.id)}>{c.active ? 'Turn off' : 'Turn on'}</button><button className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(c)}>Delete</button></div>}</td>
          </tr>))}</tbody>
      </table>
    </div>);
  return (
    <>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div style={{ fontSize: 15, color: '#5B6270', maxWidth: 640, lineHeight: 1.6 }}>Pay categories decide what can appear on a payslip. Add your own — transport allowance, a loan instalment, EOBI — and they become available in Pay Profiles and the pay run.</div>
        <button className="btn btn-primary" style={{ fontSize: 15, padding: '10px 18px' }} onClick={() => setShowNew(true)}>+ New category</button>
      </div>
      {group('Earning')}{group('Deduction')}
      <Modal open={showNew} onClose={() => setShowNew(false)}><CategoryForm onClose={() => setShowNew(false)} /></Modal>
    </>
  );
}

function CategoryForm({ onClose }: { onClose: () => void }) {
  const { setPayrollCategories } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(''); const [kind, setKind] = useState<'Earning' | 'Deduction'>('Earning');
  const [mode, setMode] = useState<'Fixed' | 'Variable'>('Fixed'); const [posting, setPosting] = useState<PayrollCategory['posting']>('Salary');
  function save() {
    if (!name.trim()) { toast('Enter a name'); return; }
    setPayrollCategories(prev => [...prev, { id: genId('cat'), name: name.trim(), kind, mode, posting: kind === 'Earning' ? posting : 'Salary', active: true }]);
    toast('Category added'); onClose();
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>New pay category</ModalTitle>
      <label style={lbl}>Name</label><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="e.g. Fuel allowance" />
      <label style={lbl}>Type</label>
      <select value={kind} onChange={e => setKind(e.target.value as 'Earning' | 'Deduction')} style={inputStyle}><option value="Earning">Earning — added to pay</option><option value="Deduction">Deduction — taken from pay</option></select>
      <label style={lbl}>How is it used?</label>
      <select value={mode} onChange={e => setMode(e.target.value as 'Fixed' | 'Variable')} style={inputStyle}><option value="Fixed">Fixed — same amount every month, set per person</option><option value="Variable">Variable — entered each month during the pay run</option></select>
      {kind === 'Earning' && (<><label style={lbl}>Recorded in Accounts as</label>
        <select value={posting} onChange={e => setPosting(e.target.value as PayrollCategory['posting'])} style={inputStyle}><option>Salary</option><option>Commission</option><option>Bonus</option><option>Appreciation</option></select></>)}
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Add category</button></ModalFoot>
    </div>
  );
}

// ======================================================================
// ADVANCES
// ======================================================================
function AdvancesTab() {
  const { staffAdvances } = useAppData();
  const [showNew, setShowNew] = useState(false);
  const rows = staffAdvances.slice().sort((a, b) => b.date.localeCompare(a.date));
  const outstanding = rows.reduce((s, a) => s + (a.amount - a.recovered), 0);
  return (
    <>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div style={{ fontSize: 15, color: '#5B6270', maxWidth: 640, lineHeight: 1.6 }}>An advance is money you give a staff member before payday. The cash leaves your account now, and the monthly instalment is deducted automatically in each pay run until it is cleared.</div>
        <button className="btn btn-primary" style={{ fontSize: 15, padding: '10px 18px' }} onClick={() => setShowNew(true)}>+ Give an advance</button>
      </div>
      <div className="card mb-4" style={{ display: 'inline-block' }}><div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>Staff owe you</div><div style={{ fontSize: 26, fontWeight: 700, color: NAVY }}>{money(outstanding)}</div></div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {rows.length === 0 ? <div style={{ padding: 20, fontSize: 15, color: '#5B6270' }}>No advances given yet.</div> :
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Date</th><th style={th}>Employee</th><th style={{ ...th, ...R }}>Advance</th><th style={{ ...th, ...R }}>Per month</th><th style={{ ...th, ...R }}>Recovered</th><th style={{ ...th, ...R }}>Still owed</th><th style={th}>Reason</th></tr></thead>
            <tbody>{rows.map(a => (
              <tr key={a.id}><td style={td}>{fmtDate(a.date)}</td><td style={td}><b>{a.staffName}</b></td><td style={{ ...td, ...R }}>{money(a.amount)}</td><td style={{ ...td, ...R }}>{money(a.monthlyRecovery)}</td><td style={{ ...td, ...R }}>{money(a.recovered)}</td>
                <td style={{ ...td, ...R, fontWeight: 700, color: a.amount - a.recovered > 0 ? '#B5433A' : '#0B6E4F' }}>{a.amount - a.recovered > 0 ? money(a.amount - a.recovered) : 'Cleared'}</td><td style={{ ...td, fontSize: 14 }}>{a.reason || '—'}</td></tr>))}</tbody>
          </table>}
      </div>
      <Modal open={showNew} onClose={() => setShowNew(false)}><AdvanceForm onClose={() => setShowNew(false)} /></Modal>
    </>
  );
}

function AdvanceForm({ onClose }: { onClose: () => void }) {
  const { team, setStaffAdvances, setTransactions, logActivity } = useAppData();
  const toast = useToast();
  const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
  const [staffId, setStaffId] = useState(staff[0]?.id || ''); const [amount, setAmount] = useState(''); const [monthly, setMonthly] = useState(''); const [reason, setReason] = useState('');
  function save() {
    const t = team.find(x => x.id === staffId); const amt = Math.round(Number(amount)); const per = Math.round(Number(monthly)) || amt;
    if (!t || !(amt > 0)) { toast('Enter the advance amount'); return; }
    setStaffAdvances(prev => [...prev, { id: genId('adv'), staffId: t.id, staffName: t.name, date: today(), amount: amt, monthlyRecovery: Math.min(per, amt), recovered: 0, reason }]);
    setTransactions(prev => [...prev, { id: genId('tx'), date: today(), type: 'Expense', category: 'Staff advance', party: t.name, amount: amt, note: reason || 'Salary advance' }]);
    logActivity(`Advance given — ${t.name}, ${money(amt)}`); toast('Advance recorded in Accounts'); onClose();
  }
  return (
    <div style={{ fontFamily: ARIAL }}>
      <ModalTitle>Give a salary advance</ModalTitle>
      <label style={lbl}>Employee</label><select value={staffId} onChange={e => setStaffId(e.target.value)} style={inputStyle}>{staff.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}</select>
      <div className="grid grid-cols-2 gap-3">
        <div><label style={lbl}>Advance amount (PKR)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} /></div>
        <div><label style={lbl}>Deduct per month (PKR)</label><input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} style={inputStyle} placeholder="whole amount if empty" /></div>
      </div>
      <label style={lbl}>Reason</label><input value={reason} onChange={e => setReason(e.target.value)} style={inputStyle} />
      <div style={{ fontSize: 13.5, color: '#5B6270', marginTop: 8 }}>This is recorded as money paid out today, and recovered through payroll.</div>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Give advance</button></ModalFoot>
    </div>
  );
}

// ======================================================================
// REPORTS
// ======================================================================
function ReportsTab() {
  const { payRuns } = useAppData();
  const runs = payRuns.slice().sort((a, b) => b.month.localeCompare(a.month));
  const [month, setMonth] = useState(runs[0]?.month || '');
  const run = payRuns.find(r => r.month === month);
  if (!runs.length) return <div className="card" style={{ fontSize: 15.5 }}>Reports appear here after your first pay run.</div>;
  const byCat = new Map<string, { kind: string; total: number }>();
  const byDept = new Map<string, { count: number; gross: number; ded: number; net: number }>();
  run?.lines.forEach(l => {
    l.items.forEach(i => { const k = i.label; byCat.set(k, { kind: i.kind, total: (byCat.get(k)?.total || 0) + i.amount }); });
    const d = byDept.get(l.department) || { count: 0, gross: 0, ded: 0, net: 0 };
    byDept.set(l.department, { count: d.count + 1, gross: d.gross + lineGross(l), ded: d.ded + lineDed(l), net: d.net + lineNet(l) });
  });
  const T = run ? runTotals(run) : null;
  const bankSheet = () => run && exportToCsv(`bank-transfer-${run.month}`, run.lines.map(l => ({ Employee: l.staffName, 'Employee ID': l.employeeId, Bank: l.bankName, 'Account / IBAN': l.accountNo, 'Net pay (PKR)': lineNet(l), Status: l.paid ? 'Paid' : 'To pay' })));
  const register = () => run && exportToCsv(`payroll-register-${run.month}`, run.lines.map(l => ({ Employee: l.staffName, 'Employee ID': l.employeeId, Department: l.department, 'Gross (PKR)': lineGross(l), 'Deductions (PKR)': lineDed(l), 'Net pay (PKR)': lineNet(l), Status: l.paid ? 'Paid' : 'To pay' })));
  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, width: 220, fontWeight: 700 }}>{runs.map(r => <option key={r.id} value={r.month}>{monthLabel(r.month)} — {r.status}</option>)}</select>
        <button className="btn" style={{ fontSize: 15, padding: '9px 16px' }} onClick={bankSheet}>Download bank transfer sheet</button>
        <button className="btn" style={{ fontSize: 15, padding: '9px 16px' }} onClick={register}>Download payroll register</button>
      </div>
      {run && T && (<>
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[['Staff', String(run.lines.length)], ['Gross earnings', money(T.gross)], ['Deductions', money(T.ded)], ['Net payroll cost', money(T.net)]].map(([a, b]) => (
            <div key={a} className="card"><div style={{ fontSize: 13.5, fontWeight: 700, color: '#5B6270' }}>{a}</div><div style={{ fontSize: 24, fontWeight: 700, color: NAVY }}>{b}</div></div>))}
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>By pay category</th><th style={{ ...th, ...R }}>Total</th></tr></thead>
            <tbody>{Array.from(byCat.entries()).sort((a, b) => b[1].total - a[1].total).map(([k, v]) => <tr key={k}><td style={td}>{k} <span style={{ fontSize: 12, color: v.kind === 'Earning' ? '#0B6E4F' : '#B5433A' }}>({v.kind.toLowerCase()})</span></td><td style={{ ...td, ...R }}>{money(v.total)}</td></tr>)}</tbody></table></div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>By department</th><th style={{ ...th, ...R }}>Staff</th><th style={{ ...th, ...R }}>Net</th></tr></thead>
            <tbody>{Array.from(byDept.entries()).sort((a, b) => b[1].net - a[1].net).map(([k, v]) => <tr key={k}><td style={td}>{k}</td><td style={{ ...td, ...R }}>{v.count}</td><td style={{ ...td, ...R }}>{money(v.net)}</td></tr>)}</tbody></table></div>
        </div>
      </>)}
      <div className="card mt-5" style={{ padding: 0, overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>All pay runs</th><th style={{ ...th, ...R }}>Staff</th><th style={{ ...th, ...R }}>Gross</th><th style={{ ...th, ...R }}>Deductions</th><th style={{ ...th, ...R }}>Net</th><th style={th}>Status</th></tr></thead>
        <tbody>{runs.map(r => { const t = runTotals(r); return <tr key={r.id}><td style={td}><b>{monthLabel(r.month)}</b></td><td style={{ ...td, ...R }}>{r.lines.length}</td><td style={{ ...td, ...R }}>{money(t.gross)}</td><td style={{ ...td, ...R }}>{money(t.ded)}</td><td style={{ ...td, ...R, fontWeight: 700 }}>{money(t.net)}</td><td style={td}>{r.status}</td></tr>; })}</tbody></table></div>
    </>
  );
}
