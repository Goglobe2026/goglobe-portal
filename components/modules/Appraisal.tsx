'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, genId, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { caseForTx, monthLabel, shiftMonth } from '@/lib/finance';
import { ARIAL, NAVY, th, td, R, inputStyle, bigBtn } from '@/components/ui/docStyles';
import type { TeamMember } from '@/lib/types';

function useMetrics(month: string) {
  const { cases, transactions, leads, attendance, clientFeedback, staffTargets, appraisals } = useAppData();
  const todayStr = today();
  return (t: TeamMember) => {
    const closed = cases.filter(c => c.consultant === t.id && c.status === 'Approved' && c.createdAt.slice(0, 7) === month).length;
    const revenue = transactions.filter(x => x.type === 'Income' && x.date.slice(0, 7) === month).reduce((s, x) => caseForTx(x, cases)?.consultant === t.id ? s + x.amount : s, 0);
    const myLeads = leads.filter(l => l.assignedTo === t.id && l.createdAt.slice(0, 7) === month);
    const [y, m] = month.split('-').map(Number); const dim = new Date(y, m, 0).getDate(); let elapsed = 0;
    for (let d = 1; d <= dim; d++) { if (new Date(y, m - 1, d).getDay() === 0) continue; const iso = `${month}-${String(d).padStart(2, '0')}`; if (iso <= todayStr && (!t.contractStart || iso >= t.contractStart)) elapsed++; }
    const recs = attendance.filter(a => a.staffId === t.id && a.date.slice(0, 7) === month);
    const attendancePct = recs.length && elapsed ? Math.min(100, Math.round(recs.filter(a => a.checkIn || a.onApprovedLeave).length / elapsed * 100)) : null;
    const fb = clientFeedback.filter(f => f.consultantId === t.id && f.submittedAt.slice(0, 7) === month);
    const rating = fb.length ? fb.reduce((s, f) => s + f.rating, 0) / fb.length : null;
    const target = staffTargets.find(x => x.staffId === t.id && x.month === month);
    return { closed, revenue, leads: myLeads.length, converted: myLeads.filter(l => l.stage === 'Converted').length, attendancePct, rating, target, ap: appraisals.find(a => a.staffId === t.id && a.month === month) };
  };
}
const pctOf = (actual: number, target: number) => target > 0 ? Math.min(100, Math.round(actual / target * 100)) : null;
const targetPct = (closed: number, rev: number, cT: number, rT: number) => { const p = [pctOf(closed, cT), pctOf(rev, rT)].filter((x): x is number => x !== null); return p.length ? Math.round(p.reduce((s, x) => s + x, 0) / p.length) : null; };
function scoreOf(tp: number | null, att: number | null, mgr: number, client: number | null) {
  const comps: [number | null, number][] = [[tp, 40], [att, 20], [mgr ? mgr * 20 : null, 30], [client !== null ? client * 20 : null, 10]];
  const a = comps.filter((c): c is [number, number] => c[0] !== null); const w = a.reduce((s, [, x]) => s + x, 0);
  return w ? Math.round(a.reduce((s, [v, x]) => s + v * x, 0) / w) : null;
}
const Bar = ({ pct }: { pct: number | null }) => pct === null ? <span style={{ color: '#93AC9F' }}>No target</span> :
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 10, background: '#E7EEF0', borderRadius: 6, minWidth: 90 }}><div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: pct >= 100 ? '#0B6E4F' : pct >= 60 ? '#C9922E' : '#B5433A' }} /></div><b style={{ fontSize: 14 }}>{pct}%</b></div>;

export function Appraisal() {
  const todayStr = today();
  const [month, setMonth] = useState(shiftMonth(todayStr.slice(0, 7), -1));
  const [tab, setTab] = useState<'appraisal' | 'targets'>('appraisal');
  return (
    <div style={{ fontFamily: ARIAL }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-2">{([['appraisal', 'Monthly Appraisal'], ['targets', 'Monthly Targets']] as const).map(([k, l]) => (
          <button key={k} className="btn" onClick={() => setTab(k)} style={{ fontSize: 15, padding: '9px 18px', fontWeight: 700, background: tab === k ? NAVY : '#fff', color: tab === k ? '#fff' : NAVY, borderColor: tab === k ? NAVY : '#DCE5E0' }}>{l}</button>))}</div>
        <div className="flex items-center gap-2">
          <button className="btn" style={bigBtn} onClick={() => setMonth(shiftMonth(month, -1))}>‹ Earlier</button>
          <div style={{ fontSize: 21, fontWeight: 700, color: NAVY, minWidth: 180, textAlign: 'center' }}>{monthLabel(month)}</div>
          <button className="btn" style={bigBtn} disabled={month >= todayStr.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}>Later ›</button>
        </div>
      </div>
      {tab === 'targets' ? <TargetsTab key={month} month={month} /> : <AppraisalTab key={month} month={month} />}
    </div>
  );
}

function TargetsTab({ month }: { month: string }) {
  const { team, staffTargets, setStaffTargets, logActivity } = useAppData();
  const toast = useToast();
  const metricsFor = useMetrics(month);
  const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
  const init = () => Object.fromEntries(staff.map(t => { const x = staffTargets.find(s => s.staffId === t.id && s.month === month); return [t.id, { c: x ? String(x.casesTarget || '') : '', r: x ? String(x.revenueTarget || '') : '' }]; }));
  const [draft, setDraft] = useState<Record<string, { c: string; r: string }>>(init);
  const set = (id: string, k: 'c' | 'r', v: string) => setDraft(p => ({ ...p, [id]: { ...p[id], [k]: v } }));
  function copyLast() {
    const prev = shiftMonth(month, -1); const last = staffTargets.filter(x => x.month === prev);
    if (!last.length) { toast(`No targets were set for ${monthLabel(prev)}`); return; }
    setDraft(p => { const n = { ...p }; last.forEach(x => { n[x.staffId] = { c: String(x.casesTarget || ''), r: String(x.revenueTarget || '') }; }); return n; });
  }
  function save() {
    const recs = staff.map(t => ({ id: genId('tg'), staffId: t.id, month, casesTarget: Number(draft[t.id]?.c) || 0, revenueTarget: Number(draft[t.id]?.r) || 0 })).filter(x => x.casesTarget > 0 || x.revenueTarget > 0);
    setStaffTargets(prev => [...prev.filter(x => x.month !== month), ...recs]);
    logActivity(`Targets set — ${monthLabel(month)}, ${recs.length} staff`); toast('Targets saved');
  }
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div style={{ fontSize: 15, color: '#5B6270', maxWidth: 620, lineHeight: 1.6 }}>Set what each person should achieve this month. Progress fills in by itself from their closed cases and the money collected on their clients’ cases.</div>
        <div className="flex gap-2"><button className="btn" style={bigBtn} onClick={copyLast}>Copy last month</button><button className="btn btn-primary" style={bigBtn} onClick={save}>Save targets</button></div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Employee</th><th style={th}>Cases to close</th><th style={th}>Closed so far</th><th style={th}>Revenue to collect (PKR)</th><th style={th}>Collected so far</th><th style={th}>Progress</th></tr></thead>
          <tbody>{staff.map(t => { const m = metricsFor(t); const d = draft[t.id] || { c: '', r: '' }; const tp = targetPct(m.closed, m.revenue, Number(d.c), Number(d.r));
            return (<tr key={t.id}><td style={td}><b>{t.name}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{t.role}</div></td>
              <td style={td}><input type="number" value={d.c} onChange={e => set(t.id, 'c', e.target.value)} style={{ ...inputStyle, width: 90 }} /></td><td style={td}>{m.closed}</td>
              <td style={td}><input type="number" value={d.r} onChange={e => set(t.id, 'r', e.target.value)} style={{ ...inputStyle, width: 150 }} /></td><td style={td}>{money(m.revenue)}</td>
              <td style={{ ...td, minWidth: 190 }}><Bar pct={tp} /></td></tr>); })}</tbody>
        </table>
      </div>
    </>
  );
}

function AppraisalTab({ month }: { month: string }) {
  const { team, appraisals, setAppraisals, logActivity } = useAppData();
  const toast = useToast();
  const metricsFor = useMetrics(month);
  const staff = team.filter(t => t.employmentStatus !== 'Resigned' && t.employmentStatus !== 'Terminated');
  const [edit, setEdit] = useState<Record<string, { rating: number; comments: string }>>(
    Object.fromEntries(staff.map(t => { const a = appraisals.find(x => x.staffId === t.id && x.month === month); return [t.id, { rating: a?.rating || 0, comments: a?.comments || '' }]; })));
  const rows = staff.map(t => { const m = metricsFor(t); const e = edit[t.id] || { rating: 0, comments: '' };
    const tp = targetPct(m.closed, m.revenue, m.target?.casesTarget || 0, m.target?.revenueTarget || 0);
    return { t, m, e, tp, score: scoreOf(tp, m.attendancePct, e.rating, m.rating) }; })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const top = rows.find(r => r.score !== null && r.e.rating > 0);
  function save() {
    const recs = rows.filter(r => r.e.rating > 0 || r.e.comments.trim()).map(r => ({ id: genId('apr'), staffId: r.t.id, month, rating: r.e.rating, comments: r.e.comments, score: r.score ?? 0, savedDate: today() }));
    setAppraisals(prev => [...prev.filter(x => x.month !== month), ...recs]);
    logActivity(`Appraisal saved — ${monthLabel(month)}, ${recs.length} staff`); toast('Appraisal saved');
  }
  return (
    <>
      {top && <div className="card mb-4" style={{ background: '#FBF0DD', border: '1px solid #E8C784' }}><div style={{ fontSize: 13.5, fontWeight: 700, color: '#8a5a12' }}>TOP PERFORMER — {monthLabel(month).toUpperCase()}</div><div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>{top.t.name} <span style={{ fontSize: 16, color: '#0B6E4F' }}>· score {top.score}</span></div></div>}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div style={{ fontSize: 14.5, color: '#5B6270', maxWidth: 700, lineHeight: 1.6 }}>Score = targets achieved (40%) + attendance (20%) + your own rating (30%) + average client rating (10%). Anything with no data yet is left out and the rest are re-weighted, so nobody is marked down for missing information.</div>
        <button className="btn btn-primary" style={bigBtn} onClick={save}>Save appraisal</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>#</th><th style={th}>Employee</th><th style={th}>Targets</th><th style={th}>Attendance</th><th style={th}>Client rating</th><th style={th}>Your rating</th><th style={{ ...th, ...R }}>Score</th><th style={th}>Comments</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.t.id}><td style={td}>{i + 1}</td><td style={td}><b>{r.t.name}</b><div style={{ fontSize: 13, color: '#5B6270' }}>{r.t.role}</div></td>
              <td style={{ ...td, minWidth: 150 }}><Bar pct={r.tp} /><div style={{ fontSize: 12.5, color: '#5B6270' }}>{r.m.closed} closed · {money(r.m.revenue)}</div></td>
              <td style={td}>{r.m.attendancePct === null ? <span style={{ color: '#93AC9F' }}>No data</span> : `${r.m.attendancePct}%`}</td>
              <td style={td}>{r.m.rating === null ? <span style={{ color: '#93AC9F' }}>None</span> : `${r.m.rating.toFixed(1)} / 5`}</td>
              <td style={td}><select value={r.e.rating} onChange={e => setEdit(p => ({ ...p, [r.t.id]: { ...p[r.t.id], rating: Number(e.target.value) } }))} style={{ ...inputStyle, width: 110 }}><option value={0}>Not rated</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} — {['', 'Poor', 'Needs work', 'Good', 'Very good', 'Excellent'][n]}</option>)}</select></td>
              <td style={{ ...td, ...R, fontSize: 20, fontWeight: 700, color: r.score === null ? '#93AC9F' : r.score >= 75 ? '#0B6E4F' : r.score >= 50 ? '#8a5a12' : '#B5433A' }}>{r.score ?? '—'}</td>
              <td style={td}><input value={r.e.comments} onChange={e => setEdit(p => ({ ...p, [r.t.id]: { ...p[r.t.id], comments: e.target.value } }))} style={{ ...inputStyle, minWidth: 200 }} placeholder="Feedback for this month" /></td></tr>))}</tbody>
        </table>
      </div>
    </>
  );
}
