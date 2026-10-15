'use client';
import { useMemo } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, today } from '@/lib/constants';
import { shiftMonth, monthLabel, payrollDueDate, daysBetween } from '@/lib/finance';
import { moneyHome } from '@/lib/money';
import { useMoneyInput } from './useMoney';

export interface GroupStat { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }

// The few live numbers shown on a group's card and at the top of its page.
export function useGroupStats(groupId: string): GroupStat[] {
  const { leads, cases, appointments, team, requests, payRuns, qcChecks, messages } = useAppData();
  const input = useMoneyInput();
  const todayStr = today();
  const mh = useMemo(() => (groupId === 'grp-finance' ? moneyHome(todayStr.slice(0, 7), input, todayStr) : null), [groupId, input, todayStr]);

  if (groupId === 'grp-marketing') {
    const overdue = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= todayStr && !['Converted', 'Lost'].includes(l.stage)).length;
    const tagged = leads.flatMap(l => l.messages).filter(m => m.direction === 'Out' && (m.responded === 'Yes' || m.responded === 'No'));
    const responded = tagged.filter(m => m.responded === 'Yes').length;
    return [
      { label: 'Follow-ups due', value: String(overdue), tone: overdue ? 'warn' : 'good' },
      { label: 'New today', value: String(leads.filter(l => l.createdAt === todayStr).length) },
      { label: 'Total leads', value: String(leads.length) },
      { label: 'Response rate', value: tagged.length ? `${Math.round((responded / tagged.length) * 100)}%` : '—' },
    ];
  }
  if (groupId === 'grp-cases') {
    return [
      { label: 'Active cases', value: String(cases.filter(c => c.status === 'Active').length) },
      { label: 'Awaiting review', value: String(cases.filter(c => c.caseStage === 'Manager Review').length) },
      { label: 'Appointments ahead', value: String(appointments.filter(a => a.date >= todayStr).length) },
      { label: 'Total cases', value: String(cases.length) },
    ];
  }
  if (groupId === 'grp-hr') {
    const key = shiftMonth(todayStr.slice(0, 7), -1);
    const r = payRuns.find(x => x.month === key);
    const d = daysBetween(todayStr, payrollDueDate(key));
    const name = monthLabel(key).split(' ')[0];
    const pay = r?.status === 'Paid' ? 'Paid' : d < 0 ? `overdue ${-d}d` : d === 0 ? 'due today' : `due in ${d}d`;
    return [
      { label: 'Team members', value: String(team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active').length) },
      { label: 'Requests waiting', value: String(requests.filter(r => r.status === 'Pending').length), tone: requests.some(r => r.status === 'Pending') ? 'warn' : 'good' },
      { label: `${name} payroll`, value: pay, tone: r?.status === 'Paid' ? 'good' : d < 0 ? 'bad' : undefined },
    ];
  }
  if (groupId === 'grp-finance' && mh) {
    return [
      { label: 'Received this month', value: money(mh.received), tone: 'good' },
      { label: 'Clients still owe', value: money(mh.stillOwed), tone: mh.stillOwed ? 'warn' : 'good' },
      { label: 'Spent this month', value: money(mh.spent) },
      { label: 'What we kept', value: money(mh.kept), tone: mh.kept >= 0 ? 'good' : 'bad' },
    ];
  }
  if (groupId === 'grp-quality') {
    return [{ label: 'Files checked', value: String(qcChecks.length) }, { label: 'Messages', value: String(messages.length) }];
  }
  return [];
}
