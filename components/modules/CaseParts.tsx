'use client';
// Small building blocks shared by the "New case" form and the case file:
// the family-member list, the "who closed it" picker and per-case bonuses.
import { useRef, useState } from 'react';
import { genId } from '@/lib/constants';
import { monthLabel } from '@/lib/finance';
import type { FamilyMember, CaseBonus, TeamMember } from '@/lib/types';

export const RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Other'];

export function blankMember(): FamilyMember { return { id: genId('fm'), name: '', relation: 'Other', passportNo: '', age: '' }; }

// "Ali Khan, Son, AB1234567, 12" — one person per line. Only the name is required.
export function parseMemberList(text: string): FamilyMember[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const [name, rel, passport, age] = line.split(/[,\t]/).map(x => x.trim());
    const relation = RELATIONS.find(r => r.toLowerCase() === (rel || '').toLowerCase()) || 'Other';
    return { id: genId('fm'), name: name || '', relation, passportNo: passport || '', age: age || '' };
  }).filter(m => m.name);
}

const cellInput = { width: '100%', padding: '6px 8px', fontSize: 13.5 } as const;

export function FamilyEditor({ members, onChange, extraAction }: {
  members: FamilyMember[]; onChange: (m: FamilyMember[]) => void;
  extraAction?: (m: FamilyMember) => React.ReactNode;
}) {
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const upd = (id: string, patch: Partial<FamilyMember>) => onChange(members.map(m => m.id === id ? { ...m, ...patch } : m));
  function addRow() {
    onChange([...members, blankMember()]);
    setTimeout(() => { const ins = box.current?.querySelectorAll<HTMLInputElement>('input[data-fm-name]'); ins?.[ins.length - 1]?.focus(); }, 30);
  }
  function addPasted() {
    const list = parseMemberList(paste);
    if (!list.length) return;
    onChange([...members.filter(m => m.name.trim()), ...list]);
    setPaste(''); setShowPaste(false);
  }
  return (
    <div ref={box}>
      {members.length > 0 && (
        <div className="overflow-auto rounded-[10px] border mb-2" style={{ borderColor: 'var(--line)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['#', 'Name', 'Relation', 'Passport no. (optional)', 'Age', ''].map(h => <th key={h} style={{ textAlign: 'left', fontSize: 12, padding: '7px 8px' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ padding: '4px 8px', fontSize: 13, color: 'var(--muted)', width: 28 }}>{i + 2}</td>
                  <td style={{ padding: '4px 6px', minWidth: 170 }}>
                    <input data-fm-name value={m.name} placeholder="Full name" style={cellInput}
                      onChange={e => upd(m.id, { name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRow(); } }} />
                  </td>
                  <td style={{ padding: '4px 6px', width: 130 }}>
                    <select value={m.relation} style={cellInput} onChange={e => upd(m.id, { relation: e.target.value })}>
                      {RELATIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '4px 6px', width: 150 }}><input value={m.passportNo || ''} style={cellInput} onChange={e => upd(m.id, { passportNo: e.target.value })} /></td>
                  <td style={{ padding: '4px 6px', width: 64 }}><input value={m.age || ''} inputMode="numeric" style={cellInput} onChange={e => upd(m.id, { age: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} /></td>
                  <td style={{ padding: '4px 6px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {extraAction?.(m)}
                    <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => onChange(members.filter(x => x.id !== m.id))}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-sm" onClick={addRow}>+ Add family member</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowPaste(s => !s)}>{showPaste ? 'Hide paste box' : 'Paste a list of names'}</button>
      </div>
      {showPaste && (
        <div className="mt-2">
          <textarea rows={5} value={paste} onChange={e => setPaste(e.target.value)}
            placeholder={'One person per line:\nAyesha Khan, Spouse\nHamza Khan, Son, AB1234567, 12\nSara Khan, Daughter'} style={{ width: '100%', fontSize: 13.5 }} />
          <button type="button" className="btn btn-sm btn-primary mt-1.5" onClick={addPasted}>Add these people</button>
        </div>
      )}
    </div>
  );
}

// Who closed the deal, and when. The month of the closing date is the month
// it counts in that person's performance and payroll.
export function ClosingEditor({ closedBy, closedDate, staff, onChange }: {
  closedBy: string; closedDate: string; staff: TeamMember[];
  onChange: (patch: { closedBy?: string; closedDate?: string }) => void;
}) {
  const who = staff.find(t => t.id === closedBy);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="mb-3">
          <label>Closed by (employee who won this client)</label>
          <select value={closedBy} onChange={e => onChange({ closedBy: e.target.value })}>
            <option value="">— Not closed yet —</option>
            {staff.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label>Closing date</label>
          <input type="date" value={closedDate} onChange={e => onChange({ closedDate: e.target.value })} />
        </div>
      </div>
      <div className="text-[12px] -mt-1 mb-3" style={{ color: who && closedDate ? 'var(--green)' : 'var(--faint)' }}>
        {who && closedDate
          ? `Counts in ${who.name}'s ${monthLabel(closedDate.slice(0, 7))} performance, targets and payroll.`
          : 'Pick the employee and the date the deal was closed so it counts in their performance and payroll. Past dates are fine when entering older cases.'}
      </div>
    </>
  );
}

// Optional bonuses on this case: choose an employee and an amount. Unpaid
// bonuses appear automatically in that employee's payroll for the month.
export function BonusEditor({ bonuses, staff, defaultMonth, onChange }: {
  bonuses: CaseBonus[]; staff: TeamMember[]; defaultMonth: string; onChange: (b: CaseBonus[]) => void;
}) {
  const upd = (id: string, patch: Partial<CaseBonus>) => onChange(bonuses.map(b => b.id === id ? { ...b, ...patch } : b));
  const nameOf = (id: string) => staff.find(t => t.id === id)?.name || 'Former staff';
  return (
    <div>
      {bonuses.length === 0 && <div className="text-[12.5px] text-[var(--muted)] mb-2">No bonus on this case. Add one to reward an employee for it — it will show up as its own line in their payroll.</div>}
      {bonuses.map(b => b.paid ? (
        <div key={b.id} className="flex items-center gap-3 text-[13px] py-1.5 border-b flex-wrap" style={{ borderColor: 'var(--line)' }}>
          <b>{nameOf(b.staffId)}</b><span>PKR {b.amount.toLocaleString()}</span>{b.note && <span className="text-[var(--muted)]">{b.note}</span>}
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>Paid{b.paidRunMonth ? ` with ${monthLabel(b.paidRunMonth)} payroll` : ''}</span>
        </div>
      ) : (
        <div key={b.id} className="grid gap-2 mb-2 items-end" style={{ gridTemplateColumns: 'minmax(150px,2fr) minmax(100px,1fr) minmax(120px,2fr) 140px auto' }}>
          <div><label className="text-[11.5px]">Employee</label>
            <select value={b.staffId} onChange={e => upd(b.id, { staffId: e.target.value })}>
              <option value="">Select employee…</option>
              {staff.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          <div><label className="text-[11.5px]">Amount (PKR)</label>
            <input type="number" value={b.amount || ''} onChange={e => upd(b.id, { amount: Math.max(0, Number(e.target.value) || 0) })} /></div>
          <div><label className="text-[11.5px]">Note</label>
            <input value={b.note} placeholder="e.g. Family of 6 closed" onChange={e => upd(b.id, { note: e.target.value })} /></div>
          <div><label className="text-[11.5px]">Pay in payroll of</label>
            <input type="month" value={b.month} onChange={e => upd(b.id, { month: e.target.value })} /></div>
          <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => onChange(bonuses.filter(x => x.id !== b.id))}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => onChange([...bonuses, { id: genId('cb'), staffId: '', amount: 0, note: '', month: defaultMonth, paid: false }])}>+ Add a bonus for this case</button>
    </div>
  );
}
