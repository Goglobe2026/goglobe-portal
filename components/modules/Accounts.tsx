'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { overallCharge, overallPaid } from './Cases';
import { exportToCsv } from '@/lib/csv';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

export function Accounts() {
  const { cases, transactions, setTransactions } = useAppData();
  const [showExpense, setShowExpense] = useState(false);
  const toast = useToast();

  const income = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
  const net = income - expense;
  const receivable = cases.reduce((s, c) => s + (overallCharge(c) - overallPaid(c)), 0);
  const sortedTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  function deleteTx(id: string) { setTransactions(prev => prev.filter(t => t.id !== id)); toast('Entry removed'); }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
        <Metric label="Total income" value={money(income)} />
        <Metric label="Total expenses" value={money(expense)} />
        <Metric label="Net profit" value={money(net)} color={net >= 0 ? 'var(--green)' : 'var(--red)'} />
        <Metric label="Accounts receivable" value={money(receivable)} note={`Owed across ${cases.filter(c => overallCharge(c) > overallPaid(c)).length} cases`} />
      </div>

      <SectionHead title="Outstanding balances" count="consultation + visa fee + appointment fee, combined" />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Client</th><th>Status</th><th>Overall balance</th></tr></thead>
          <tbody>
            {cases.map(c => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td><Stamp text={c.status} /></td>
                <td className="font-mono-ui text-xs">{money(overallCharge(c) - overallPaid(c))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHead title="Ledger" count={`${transactions.length} entries`} action={
        <div className="flex gap-2 ml-auto">
          <button className="btn btn-sm" onClick={() => exportToCsv('goglobe-ledger', transactions.map(t => ({
            Date: t.date, Type: t.type, Category: t.category, Party: t.party, Amount: t.amount, Note: t.note,
          })))}>Export CSV</button>
          <button className="btn btn-sm" onClick={() => setShowExpense(true)}>+ Add expense</button>
        </div>
      } />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Party</th><th>Note</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {sortedTx.map(t => (
              <tr key={t.id}>
                <td className="font-mono-ui text-xs">{fmtDate(t.date)}</td>
                <td><Stamp text={t.type === 'Income' ? 'Approved' : 'Refused'} /></td>
                <td>{t.category}</td><td>{t.party}</td><td className="text-[var(--muted)]">{t.note}</td>
                <td className="font-mono-ui text-xs" style={{ color: t.type === 'Income' ? 'var(--green)' : 'var(--red)' }}>{t.type === 'Income' ? '+' : '-'}{money(t.amount)}</td>
                <td><button className="btn btn-sm btn-ghost btn-danger" onClick={() => deleteTx(t.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showExpense} onClose={() => setShowExpense(false)}>
        <ExpenseForm onClose={() => setShowExpense(false)} />
      </Modal>
    </div>
  );
}

function Metric({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <div className="card">
      <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[26px] font-semibold mt-1.5" style={{ color }}>{value}</div>
      {note && <div className="text-[11.5px] text-[var(--faint)] mt-1">{note}</div>}
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
