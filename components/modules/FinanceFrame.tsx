'use client';
import { useState, type ReactNode } from 'react';
import { PillTabs } from '@/components/ui/Kit';
import { Accounts } from './Accounts';
import { Reports } from './Reports';

// The six Finance screens, always shown in the order you use them.
export const FINANCE_STEPS = [
  { id: 'money', label: 'Overview' },
  { id: 'billing', label: 'Who owes us' },
  { id: 'payouts', label: 'Money going out' },
  { id: 'profit', label: 'Profit & growth' },
  { id: 'closing', label: 'Month-end' },
  { id: 'accounts', label: 'Books & banks' },
] as const;
export const FINANCE_TABS: string[] = [...FINANCE_STEPS.map(s => s.id), 'reports'];

export function FinanceFrame({ tab, go, children }: { tab: string; go: (id: string) => void; children: ReactNode }) {
  const active = tab === 'reports' ? 'accounts' : tab;
  return (
    <div>
      <div className="mb-5 no-print" data-testid="finance-steps">
        <PillTabs numbered items={FINANCE_STEPS.map(s => ({ id: s.id, label: s.label }))} value={active as (typeof FINANCE_STEPS)[number]['id']} onChange={go} />
      </div>
      {children}
    </div>
  );
}

// Books & banks: every entry, plus the older reports, bank balances and loans.
export function BooksAndBanks({ start = 'entries' }: { start?: 'entries' | 'banks' }) {
  const [view, setView] = useState<'entries' | 'banks'>(start);
  return (
    <div>
      <div className="mb-4 no-print">
        <div className="seg">
          <button className={view === 'entries' ? 'on' : ''} data-testid="books-entries" onClick={() => setView('entries')}>Every entry</button>
          <button className={view === 'banks' ? 'on' : ''} data-testid="books-banks" onClick={() => setView('banks')}>Banks, loans, targets &amp; reports</button>
        </div>
      </div>
      {view === 'entries' ? <Accounts /> : <Reports />}
    </div>
  );
}
