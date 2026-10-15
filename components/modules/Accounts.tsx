'use client';
import { useMemo, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { monthLabel, shiftMonth } from '@/lib/finance';
import { exportToCsv } from '@/lib/csv';
import { Modal, ModalTitle, ModalFoot, Field } from '@/components/ui/Primitives';
import { Panel, StatCard } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';

// Every money entry, one line each. The totals, balances owed and profit live on the
// Finance overview — this page is only the list of entries.
export function Accounts() {
  const { transactions, setTransactions } = useAppData();
  const [showExpense, setShowExpense] = useState(false);
  const [month, setMonth] = useState<string>('all');
  const [kind, setKind] = useState<'all' | 'Income' | 'Expense'>('all');
  const [q, setQ] = useState('');
  const toast = useToast();

  const months = useMemo(() => Array.from(new Set(transactions.map(t => t.date.slice(0, 7)))).sort().reverse(), [transactions]);
  const rows = useMemo(() => transactions
    .filter(t => (month === 'all' || t.date.slice(0, 7) === month) && (kind === 'all' || t.type === kind)
      && (!q.trim() || `${t.category} ${t.party} ${t.note}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date)), [transactions, month, kind, q]);
  const inn = rows.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const out = rows.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);

  function deleteTx(id: string) { setTransactions(prev => prev.filter(t => t.id !== id)); toast('Entry removed'); }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4 max-md:grid-cols-1">
        <StatCard label="Money in" icon="money" color="hsl(152 62% 32%)" value={money(inn)} hint={month === 'all' ? 'All entries shown below' : `Entries in ${monthLabel(month)}`} />
        <StatCard label="Money out" icon="payouts" color="hsl(352 62% 44%)" value={money(out)} hint="Salaries, fees, ads, rent, bills" />
        <StatCard label="Difference" icon="profit" color={inn - out >= 0 ? 'hsl(128 56% 30%)' : 'hsl(352 62% 44%)'} value={`${inn - out < 0 ? '− ' : ''}${money(Math.abs(inn - out))}`} hint="Money in minus money out, for what is shown" />
      </div>

      <Panel title="All entries" subtitle={`${rows.length} of ${transactions.length} entries`} flush
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <button className="btn btn-sm" onClick={() => {
              const ok = exportToCsv('goglobe-ledger', rows.map(t => ({ Date: t.date, Type: t.type === 'Income' ? 'Money in' : 'Money out', Category: t.category, Party: t.party, Amount: t.amount, Note: t.note })));
              if (!ok) toast('No ledger entries yet to export');
            }}>Export CSV</button>
            <button className="btn btn-sm btn-primary" onClick={() => setShowExpense(true)}>+ Add expense</button>
          </div>
        }>
        <div className="flex gap-2.5 flex-wrap items-center px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="seg" role="tablist">
            {([['all', 'Everything'], ['Income', 'Money in'], ['Expense', 'Money out']] as const).map(([k, l]) => (
              <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>
            ))}
          </div>
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: 190 }} aria-label="Month">
            <option value="all">All months</option>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <input placeholder="Search by category, person or note…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 280 }} />
          {month !== 'all' && month !== shiftMonth(today().slice(0, 7), 0) && <span className="text-[12px] text-[var(--muted)]">Showing {monthLabel(month)} only</span>}
        </div>
        <div className="overflow-auto">
          <table>
            <thead><tr><th>Date</th><th></th><th>Category</th><th>Who</th><th>Note</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id}>
                  <td className="font-mono-ui text-xs whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td><span className="stamp" style={t.type === 'Income' ? { color: '#0B6E4F', background: '#E4F5EC', borderColor: '#BFE5D2' } : { color: '#B5433A', background: '#FCEBE8', borderColor: '#F4CFCA' }}><span className="stamp-dot" />{t.type === 'Income' ? 'Money in' : 'Money out'}</span></td>
                  <td>{t.category}</td><td>{t.party}</td><td className="text-[var(--muted)]">{t.note}</td>
                  <td className="font-mono-ui text-xs font-bold" style={{ textAlign: 'right', color: t.type === 'Income' ? 'hsl(152 62% 30%)' : 'hsl(352 62% 42%)' }}>{t.type === 'Income' ? '+' : '−'}{money(t.amount)}</td>
                  <td><button className="btn btn-sm btn-ghost btn-danger" onClick={() => deleteTx(t.id)}>Delete</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="text-center text-[var(--muted)] py-8">No entries match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal open={showExpense} onClose={() => setShowExpense(false)}>
        <ExpenseForm onClose={() => setShowExpense(false)} />
      </Modal>
    </div>
  );
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { setTransactions } = useAppData();
  const toast = useToast();
  const [date, setDate] = useState(today()); const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('Office rent'); const [party, setParty] = useState(''); const [note, setNote] = useState('');

  function save() {
    if (amount <= 0) { toast('Enter an amount'); return; }
    setTransactions(prev => [...prev, { id: genId('tx'), date, type: 'Expense', category, party, amount, note }]);
    toast('Expense added');
    onClose();
  }

  return (
    <>
      <ModalTitle>Add expense</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Amount (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {['Office rent', 'Marketing', 'Embassy fees', 'Salary', 'Commission', 'Bonus', 'Utilities', 'Other'].map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Paid to"><input value={party} onChange={e => setParty(e.target.value)} /></Field>
      </div>
      <Field label="Note"><input value={note} onChange={e => setNote(e.target.value)} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save expense</button>
      </ModalFoot>
    </>
  );
}
