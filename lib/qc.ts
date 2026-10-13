import type { QcCheck, Case } from './types';

// The questions every file is checked against before it is submitted.
export const DEFAULT_QC_ITEMS: string[] = [
  'Passport is valid for at least 6 months and every page is scanned clearly',
  'Name, date of birth and passport number are identical on every document',
  'Photographs meet the embassy size and background rules',
  'Application form is complete, signed and matches the passport',
  'Bank statements / financial proof are recent and match the funds stated',
  'Job, business or study proof is attached and verified',
  'Travel plan, bookings and invitation (if any) match the dates applied for',
  'Cover letter has been read and approved',
  'Every document on the checklist is marked Verified',
  'Fees are recorded on the case: consultation, visa service and appointment',
];

// The newest check of a case decides whether it may go to the manager.
export function latestQc(checks: QcCheck[], caseId: string): QcCheck | undefined {
  return checks
    .filter(c => c.caseId === caseId)
    .sort((a, b) => (b.at || b.date).localeCompare(a.at || a.date))[0];
}

export function qcPassed(checks: QcCheck[], caseId: string): boolean {
  return latestQc(checks, caseId)?.result === 'Passed';
}

// Open cases that still need a (passing) check.
export function casesNeedingQc(cases: Case[], checks: QcCheck[]): Case[] {
  return cases.filter(c => c.status === 'Active' && !qcPassed(checks, c.id));
}

export function passRate(checks: QcCheck[]): number | null {
  if (!checks.length) return null;
  return Math.round((checks.filter(c => c.result === 'Passed').length / checks.length) * 100);
}
