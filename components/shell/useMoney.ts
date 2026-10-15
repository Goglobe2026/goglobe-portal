'use client';
import { useMemo } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import type { MoneyInput } from '@/lib/money';

// Everything the money screens read, gathered once.
export function useMoneyInput(): MoneyInput {
  const { transactions, cases, leads, payRuns, loans, personalExpenses, appointments, team, bankAccounts, monthlyClosings } = useAppData();
  return useMemo(
    () => ({ transactions, cases, leads, payRuns, loans, personalExpenses, appointments, team, bankAccounts, monthlyClosings }),
    [transactions, cases, leads, payRuns, loans, personalExpenses, appointments, team, bankAccounts, monthlyClosings],
  );
}
