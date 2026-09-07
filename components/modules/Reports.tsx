'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { overallCharge, overallPaid } from './Cases';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function Reports() {
  const {
    bankAccounts, setBankAccounts, transactions, cases, leads, team,
    journalVouchers, setJournalVouchers, ceoPin, setCeoPin, revenueGoal, setRevenueGoal,
    loans, setLoans, personalExpenses, setPersonalExpenses,
  } = useAppData();
  const toast = useToast();
  const [showBank, setShowBank] = useState(false);
  const [showJv, setShowJv] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [showPersonalExpense, setShowPersonalExpense] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState(ceoPin);
  const [goalInput, setGoalInput] = useState(revenueGoal);

  const totalBank = bankAccounts.reduce((s, b) => s + b.balance, 0);
  const loansGivenOutstanding = loans.filter(l => l.direction === 'Given' && l.status === 'Active').reduce((s, l) => s + Math.max(0, l.principal - l.amountRepaid), 0);
  const loansTakenOutstanding = loans.filter(l => l.direction === 'Taken' && l.status === 'Active').reduce((s, l) => s + Math.max(0, l.principal - l.amountRepaid), 0);
  const netPosition = totalBank + loansGivenOutstanding - loansTakenOutstanding;
  const totalPersonalExpenses = personalExpenses.reduce((s, p) => s + p.amount, 0);
  const thisMonth = today().slice(0, 7);
  const incomeMonth = transactions.filter(t => t.type === 'Income' && t.date.slice(0, 7) === thisMonth).reduce((s, t) => s + t.amount, 0);
  const expenseMonth = transactions.filter(t => t.type === 'Expense' && t.date.slice(0, 7) === thisMonth).reduce((s, t) => s + t.amount, 0);

  const expenseByCategory: Record<string, number> = {};
  transactions.filter(t => t.type === 'Expense').forEach(t => { expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount; });
  const totalExpense = Object.values(expenseByCategory).reduce((a, b) => a + b, 0) || 1;

  const discountedCases = cases.filter(c => c.discount > 0);
  const totalDiscounts = discountedCases.reduce((s, c) => s + c.discount, 0);

  const sales = team.filter(t => t.department === 'Sales');
  const sow = startOfWeek();
  const weeklyData = sales.map(t => ({
    name: t.name,
    leads: leads.filter(l => l.assignedTo === t.id && l.createdAt >= sow).length,
    closed: cases.filter(c => c.consultant === t.id && c.status === 'Approved' && c.createdAt >= sow).length,
  }));

  const months: Record<string, { Income: number; Expense: number }> = {};
  transactions.forEach(t => { const m = t.date.slice(0, 7); months[m] = months[m] || { Income: 0, Expense: 0 }; months[m][t.type] += t.amount; });
  const monthKeys = Object.keys(months).sort();
  const trendData = monthKeys.map(k => ({ label: new Date(k + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), net: months[k].Income - months[k].Expense }));
  const breakdownData = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));

  function updateBank(id: string, val: string) {
    setBankAccounts(prev => prev.map(b => b.id === id ? { ...b, balance: Number(val) || 0 } : b));
  }
  function deleteBank(id: string) { setBankAccounts(prev => prev.filter(b => b.id !== id)); }
  function deleteJv(id: string) { setJournalVouchers(prev => prev.filter(j => j.id !== id)); }
  function savePin() {
    if (!pinInput.trim()) { toast('Enter a PIN'); return; }
    setCeoPin(pinInput);
    toast('CEO PIN updated');
  }
  function saveGoal() {
    const n = Number(goalInput);
    if (!n || n <= 0) { toast('Enter a valid amount'); return; }
    setRevenueGoal(String(n));
    toast('Revenue goal updated');
  }

  return (
    <div>
      <div className="card mb-3.5" style={{ background: 'linear-gradient(135deg,#14213D,#1B3358)', border: 'none', color: '#fff' }}>
        <div className="text-[11.5px] uppercase tracking-wide font-semibold" style={{ opacity: 0.75 }}>Net position right now</div>
        <div className="font-display text-[32px] font-semibold mt-1.5">{money(netPosition)}</div>
        <div className="text-[12px] mt-2" style={{ opacity: 0.85 }}>
          {money(totalBank)} in company accounts
          {loansGivenOutstanding > 0 && <> · +{money(loansGivenOutstanding)} owed to you (loans given)</>}
          {loansTakenOutstanding > 0 && <> · −{money(loansTakenOutstanding)} you owe (loans taken)</>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
        <Metric label="Total bank + cash balance" value={money(totalBank)} />
        <Metric label="Cash flow this month" value={money(incomeMonth - expenseMonth)} color={(incomeMonth - expenseMonth) >= 0 ? 'var(--green)' : 'var(--red)'} />
        <Metric label="Income this month" value={money(incomeMonth)} />
        <Metric label="Expenses this month" value={money(expenseMonth)} />
      </div>

      <SectionHead title="Discounts given" count={`${discountedCases.length} cases discounted`} />
      <div className="grid grid-cols-2 gap-3.5 mb-2 max-md:grid-cols-1">
        <div className="card">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">Total discounted away</div>
          <div className="font-display text-[26px] font-semibold mt-1.5" style={{ color: 'var(--gold)' }}>{money(totalDiscounts)}</div>
          <div className="text-[11.5px] text-[var(--faint)] mt-1">Revenue given up in exchange for closing the deal</div>
        </div>
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Client</th><th>Discount</th><th>Reason</th></tr></thead>
            <tbody>
              {discountedCases.length ? discountedCases.map(c => (
                <tr key={c.id}><td className="font-medium">{c.name}</td><td className="font-mono-ui text-xs">{money(c.discount)}</td><td className="text-[var(--muted)]">{c.discountReason || '—'}</td></tr>
              )) : <tr><td colSpan={3} className="text-[var(--muted)] p-3.5">No discounts given yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <SectionHead title="Weekly performance comparison" count="this week (Mon–today), all sales staff" />
      <div className="card" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="leads" name="Leads this week" fill="var(--gold)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="closed" name="Closed this week" fill="var(--navy)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionHead title="Monthly business trend" count="net profit by month — is the business going up or down" />
      <div className="card" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="net" stroke="var(--navy)" strokeWidth={2} dot={{ r: 4, fill: 'var(--navy)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SectionHead title="Office expenses breakdown" count="by category, all-time" />
      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <div className="card" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={breakdownData} layout="vertical">
              <CartesianGrid stroke="var(--line)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip /><Bar dataKey="amount" fill="var(--gold)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Category</th><th>Amount</th><th>% of total</th></tr></thead>
            <tbody>
              {breakdownData.length ? breakdownData.map(({ category, amount }) => (
                <tr key={category}><td className="font-medium">{category}</td><td className="font-mono-ui text-xs">{money(amount)}</td><td className="font-mono-ui text-xs">{Math.round(amount / totalExpense * 100)}%</td></tr>
              )) : <tr><td colSpan={3} className="text-[var(--muted)] p-3.5">No expenses recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <SectionHead title="Bank accounts & cash" count="manual balances — not a live bank feed" action={
        <button className="btn btn-sm ml-auto" onClick={() => setShowBank(true)}>+ Add account</button>
      } />
      <div className="card mb-3.5" style={{ background: 'var(--gold-50)' }}>
        <div className="text-[12.5px]" style={{ color: '#6b4e10' }}>These balances are entered by you and adjusted manually. Pulling live balances from an actual bank requires that bank&apos;s Open Banking API and their formal approval.</div>
      </div>
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Bank / account</th><th>Account title</th><th>Account no.</th><th>Balance</th><th></th></tr></thead>
          <tbody>
            {bankAccounts.map(b => (
              <tr key={b.id}>
                <td className="font-medium">{b.bankName}</td><td>{b.accountTitle}</td><td className="font-mono-ui text-xs">{b.accountNumber}</td>
                <td><input className="font-mono-ui w-32" type="number" value={b.balance} onChange={e => updateBank(b.id, e.target.value)} /></td>
                <td><button className="btn btn-sm btn-ghost btn-danger" onClick={() => deleteBank(b.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHead title="Journal vouchers (JV)" count={`${journalVouchers.length} entries — manual adjustments, kept separate from the automatic ledger`} action={
        <button className="btn btn-sm ml-auto" onClick={() => setShowJv(true)}>+ New JV</button>
      } />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Date</th><th>Debit account</th><th>Credit account</th><th>Amount</th><th>Narration</th><th></th></tr></thead>
          <tbody>
            {[...journalVouchers].sort((a, b) => b.date.localeCompare(a.date)).map(j => (
              <tr key={j.id}>
                <td className="font-mono-ui text-xs">{fmtDate(j.date)}</td><td>{j.debitAccount}</td><td>{j.creditAccount}</td>
                <td className="font-mono-ui text-xs">{money(j.amount)}</td><td className="text-[var(--muted)]">{j.narration}</td>
                <td><button className="btn btn-sm btn-ghost btn-danger" onClick={() => deleteJv(j.id)}>Delete</button></td>
              </tr>
            ))}
            {!journalVouchers.length && <tr><td colSpan={6} className="text-[var(--muted)] p-3.5">No journal vouchers yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionHead title="Loans" count="money you've lent out, or borrowed — tracked separately from day-to-day cash flow" action={
        <button className="btn btn-sm ml-auto" onClick={() => setShowLoan(true)}>+ Add loan</button>
      } />
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Direction</th><th>Party</th><th>Principal</th><th>Repaid</th><th>Remaining</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loans.map(l => {
              const remaining = Math.max(0, l.principal - l.amountRepaid);
              return (
                <tr key={l.id}>
                  <td><Stamp text={l.direction} /></td>
                  <td className="font-medium">{l.party}{l.notes && <div className="text-[11px] text-[var(--muted)]">{l.notes}</div>}</td>
                  <td className="font-mono-ui text-xs">{money(l.principal)}</td>
                  <td className="font-mono-ui text-xs">{money(l.amountRepaid)}</td>
                  <td className="font-mono-ui text-xs" style={{ color: remaining > 0 ? 'var(--gold)' : 'var(--green)' }}>{money(remaining)}</td>
                  <td>{l.status}</td>
                  <td>{remaining > 0 && l.status === 'Active' && <button className="btn btn-sm" onClick={() => setRepayLoanId(l.id)}>Record repayment</button>}</td>
                </tr>
              );
            })}
            {!loans.length && <tr><td colSpan={7} className="text-[var(--muted)] p-3.5">No loans recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <SectionHead title="Personal expenses" count={`${money(totalPersonalExpenses)} total — kept separate from business costs`} action={
        <button className="btn btn-sm ml-auto" onClick={() => setShowPersonalExpense(true)}>+ Add personal expense</button>
      } />
      <div className="card mb-3.5" style={{ background: 'var(--gold-50)' }}>
        <div className="text-[12.5px]" style={{ color: '#6b4e10' }}>Money drawn out for personal use, kept separate here so it never gets mixed into real business expenses or distorts your profit numbers.</div>
      </div>
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Date</th><th>Person</th><th>Category</th><th>Amount</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {[...personalExpenses].sort((a, b) => b.date.localeCompare(a.date)).map(p => (
              <tr key={p.id}>
                <td className="font-mono-ui text-xs">{fmtDate(p.date)}</td>
                <td className="font-medium">{p.person}</td>
                <td>{p.category}</td>
                <td className="font-mono-ui text-xs">{money(p.amount)}</td>
                <td className="text-[var(--muted)]">{p.note}</td>
                <td><button className="btn btn-sm btn-ghost btn-danger" onClick={() => setPersonalExpenses(prev => prev.filter(x => x.id !== p.id))}>Delete</button></td>
              </tr>
            ))}
            {!personalExpenses.length && <tr><td colSpan={6} className="text-[var(--muted)] p-3.5">No personal expenses recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
        <div>
          <SectionHead title="Owner PIN" />
          <div className="card">
            <Field label="Change CEO login PIN"><input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} maxLength={8} /></Field>
            <button className="btn btn-sm" onClick={savePin}>Save new PIN</button>
          </div>
        </div>
        <div>
          <SectionHead title="Annual revenue goal" />
          <div className="card">
            <Field label="Target for this year (PKR)"><input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} /></Field>
            <button className="btn btn-sm" onClick={saveGoal}>Save goal</button>
          </div>
        </div>
      </div>

      <Modal open={showBank} onClose={() => setShowBank(false)}><BankForm onClose={() => setShowBank(false)} /></Modal>
      <Modal open={showJv} onClose={() => setShowJv(false)}><JvForm onClose={() => setShowJv(false)} /></Modal>
      <Modal open={showLoan} onClose={() => setShowLoan(false)}><LoanForm onClose={() => setShowLoan(false)} /></Modal>
      <Modal open={!!repayLoanId} onClose={() => setRepayLoanId(null)}>{repayLoanId && <RepayLoanForm loanId={repayLoanId} onClose={() => setRepayLoanId(null)} />}</Modal>
      <Modal open={showPersonalExpense} onClose={() => setShowPersonalExpense(false)}><PersonalExpenseForm onClose={() => setShowPersonalExpense(false)} /></Modal>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card">
      <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[26px] font-semibold mt-1.5" style={{ color }}>{value}</div>
    </div>
  );
}

function BankForm({ onClose }: { onClose: () => void }) {
  const { setBankAccounts } = useAppData();
  const toast = useToast();
  const [bankName, setBankName] = useState(''); const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState(''); const [balance, setBalance] = useState(0);

  function save() {
    if (!bankName.trim()) { toast('Enter a bank name'); return; }
    setBankAccounts(prev => [...prev, { id: genId('bk'), bankName, accountTitle, accountNumber: accountNumber || '—', balance }]);
    toast('Account added');
    onClose();
  }

  return (
    <>
      <ModalTitle>Add bank account</ModalTitle>
      <Field label='Bank name (or "Cash in hand")'><input value={bankName} onChange={e => setBankName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account title"><input value={accountTitle} onChange={e => setAccountTitle(e.target.value)} /></Field>
        <Field label="Account number"><input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></Field>
      </div>
      <Field label="Current balance (PKR)"><input type="number" value={balance} onChange={e => setBalance(Number(e.target.value))} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Add account</button>
      </ModalFoot>
    </>
  );
}

function JvForm({ onClose }: { onClose: () => void }) {
  const { setJournalVouchers } = useAppData();
  const toast = useToast();
  const [date, setDate] = useState(today()); const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState(''); const [amount, setAmount] = useState(0); const [narration, setNarration] = useState('');

  function save() {
    if (amount <= 0) { toast('Enter an amount'); return; }
    setJournalVouchers(prev => [...prev, { id: genId('jv'), date, debitAccount: debitAccount || '—', creditAccount: creditAccount || '—', amount, narration }]);
    toast('Journal voucher saved');
    onClose();
  }

  return (
    <>
      <ModalTitle>New journal voucher</ModalTitle>
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Debit account"><input value={debitAccount} onChange={e => setDebitAccount(e.target.value)} /></Field>
        <Field label="Credit account"><input value={creditAccount} onChange={e => setCreditAccount(e.target.value)} /></Field>
      </div>
      <Field label="Amount (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      <Field label="Narration"><input value={narration} onChange={e => setNarration(e.target.value)} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save JV</button>
      </ModalFoot>
    </>
  );
}

function LoanForm({ onClose }: { onClose: () => void }) {
  const { setLoans } = useAppData();
  const toast = useToast();
  const [direction, setDirection] = useState<'Given' | 'Taken'>('Given');
  const [party, setParty] = useState(''); const [principal, setPrincipal] = useState(0);
  const [interestPercent, setInterestPercent] = useState(0); const [startDate, setStartDate] = useState(today());
  const [notes, setNotes] = useState('');

  function save() {
    if (!party.trim() || principal <= 0) { toast('Enter who and how much'); return; }
    setLoans(prev => [...prev, {
      id: genId('ln'), direction, party, principal, interestPercent, startDate,
      amountRepaid: 0, status: 'Active', notes,
    }]);
    toast('Loan recorded');
    onClose();
  }

  return (
    <>
      <ModalTitle>Add loan</ModalTitle>
      <Field label="Direction">
        <select value={direction} onChange={e => setDirection(e.target.value as 'Given' | 'Taken')}>
          <option value="Given">Given — we lent this out, someone owes us</option>
          <option value="Taken">Taken — we borrowed this, we owe it back</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={direction === 'Given' ? 'Borrower' : 'Lender'}><input value={party} onChange={e => setParty(e.target.value)} /></Field>
        <Field label="Principal amount (PKR)"><input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Interest (%, optional)"><input type="number" value={interestPercent} onChange={e => setInterestPercent(Number(e.target.value))} /></Field>
        <Field label="Start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
      </div>
      <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save loan</button>
      </ModalFoot>
    </>
  );
}

function RepayLoanForm({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const { loans, setLoans } = useAppData();
  const toast = useToast();
  const loan = loans.find(l => l.id === loanId)!;
  const remaining = Math.max(0, loan.principal - loan.amountRepaid);
  const [amount, setAmount] = useState(0);

  function save() {
    if (amount <= 0) { toast('Enter an amount'); return; }
    setLoans(prev => prev.map(l => {
      if (l.id !== loanId) return l;
      const newRepaid = l.amountRepaid + amount;
      return { ...l, amountRepaid: newRepaid, status: newRepaid >= l.principal ? 'Paid Off' : 'Active' };
    }));
    toast('Repayment recorded');
    onClose();
  }

  return (
    <>
      <ModalTitle>Record repayment — {loan.party}</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3">Remaining balance: <b>{money(remaining)}</b></div>
      <Field label="Amount (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save repayment</button>
      </ModalFoot>
    </>
  );
}

function PersonalExpenseForm({ onClose }: { onClose: () => void }) {
  const { setPersonalExpenses } = useAppData();
  const toast = useToast();
  const [date, setDate] = useState(today()); const [person, setPerson] = useState('');
  const [amount, setAmount] = useState(0); const [category, setCategory] = useState('Personal draw');
  const [note, setNote] = useState('');

  function save() {
    if (!person.trim() || amount <= 0) { toast('Enter who and how much'); return; }
    setPersonalExpenses(prev => [...prev, { id: genId('pe'), date, person, amount, category, note }]);
    toast('Personal expense recorded');
    onClose();
  }

  return (
    <>
      <ModalTitle>Add personal expense</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Amount (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Person"><input value={person} onChange={e => setPerson(e.target.value)} placeholder="Who took this out" /></Field>
        <Field label="Category">
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {['Personal draw', 'Family expense', 'Personal travel', 'Other'].map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Note"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save expense</button>
      </ModalFoot>
    </>
  );
}
