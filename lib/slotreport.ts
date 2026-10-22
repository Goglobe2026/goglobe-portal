import type { SlotRequest, SlotAlert, SlotAudit, SlotNotice, TeamMember } from './types';
import { addDaysIso, readiness } from './slotdesk';
import { fmtPkt, fmtOpens, CATEGORY_INFO } from './slotalerts';

// Reports, the audit trail and clean-up rules. Plain functions, no network.

// ---------- audit trail ----------
export const AUDIT_KEEP = 3000;                      // the newest entries kept; older ones are dropped when the list grows past this

export function makeAudit(by: string, area: SlotAudit['area'], action: string, o: { country?: string; ref?: string; detail?: string } = {}, id: string, atIso: string): SlotAudit {
  // The trail records WHAT happened and to WHOM by name — never phone numbers, passport numbers or the booking-pack text.
  return { id, at: atIso, by: by || 'Unknown', area, action, country: o.country || '', ref: o.ref || '', detail: (o.detail || '').slice(0, 300) };
}
export const sortAudit = (list: SlotAudit[]): SlotAudit[] => [...list].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || b.id.localeCompare(a.id));
export function trimAudit(list: SlotAudit[]): SlotAudit[] { return list.length > AUDIT_KEEP ? sortAudit(list).slice(0, AUDIT_KEEP) : list; }

export interface AuditFilter { text?: string; area?: string; by?: string; country?: string }
export function filterAudit(list: SlotAudit[], f: AuditFilter): SlotAudit[] {
  const q = (f.text || '').trim().toLowerCase();
  return sortAudit(list).filter(a =>
    (!f.area || a.area === f.area) && (!f.by || a.by === f.by) && (!f.country || a.country === f.country)
    && (!q || `${a.action} ${a.ref} ${a.detail} ${a.by} ${a.country}`.toLowerCase().includes(q)));
}

// ---------- CSV (safe to open in Excel) ----------
export type Cell = string | number | boolean | null | undefined;
/** A cell that starts with = + - @ would run as a formula in Excel, so it gets a leading quote mark. */
export function safeCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}
export function toCsvText(rows: Record<string, Cell>[], columns?: string[]): string {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  return [cols.map(safeCell).join(','), ...rows.map(r => cols.map(c => safeCell(r[c])).join(','))].join('\r\n');
}
export function downloadCsv(filename: string, rows: Record<string, Cell>[], columns: string[]): boolean {
  if (typeof document === 'undefined') return false;
  const blob = new Blob(['﻿' + toCsvText(rows, columns)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  return true;
}

export const CASE_COLUMNS = ['Client', 'Phone', 'Country', 'Centre', 'Applicants', 'Visa type', 'Purpose', 'Can accept from', 'Can accept to', 'Travel by', 'Priority', 'Readiness', 'Status', 'Looked after by', 'Appointment date', 'Appointment time', 'How booked', 'Confirmation ref', 'Added on'];
/** One row per case. The booking-pack details (passport numbers and so on) are never included. */
export function casesReport(list: SlotRequest[], team: TeamMember[]): Record<string, Cell>[] {
  const nm = (id: string) => team.find(t => t.id === id)?.name || '';
  return list.map(x => {
    const r = readiness(x);
    return {
      'Client': x.clientName, 'Phone': x.phone, 'Country': x.country, 'Centre': x.centre, 'Applicants': x.applicants, 'Visa type': x.visaType || '', 'Purpose': x.purpose || '',
      'Can accept from': x.dateFrom || '', 'Can accept to': x.dateTo || '', 'Travel by': x.travelBy, 'Priority': x.priority, 'Readiness': `${r.done}/${r.total} ${r.label}`,
      'Status': x.status, 'Looked after by': nm(x.assignedTo), 'Appointment date': x.slotDate, 'Appointment time': x.slotTime, 'How booked': x.bookedHow,
      'Confirmation ref': x.confirmationRef || '', 'Added on': x.createdAt,
    };
  });
}
export const ALERT_COLUMNS = ['Seen / announced (Pakistan time)', 'Type', 'Country', 'Centre', 'Provider', 'Source', 'Link', 'Check level', 'Opens (Pakistan time)', 'Logged by', 'Handled', 'Note'];
export function alertsReport(list: SlotAlert[]): Record<string, Cell>[] {
  return list.map(a => ({
    'Seen / announced (Pakistan time)': fmtPkt(a.at), 'Type': CATEGORY_INFO[a.category]?.short || a.category, 'Country': a.country, 'Centre': a.centre, 'Provider': a.provider, 'Source': a.source, 'Link': a.sourceUrl,
    'Check level': a.verification, 'Opens (Pakistan time)': a.opensDate ? fmtOpens(a.opensDate, a.opensTime) : '', 'Logged by': a.loggedBy, 'Handled': a.handled ? 'Yes' : 'No', 'Note': a.note,
  }));
}
export const AUDIT_COLUMNS = ['When (Pakistan time)', 'Who', 'Area', 'What happened', 'Country', 'About', 'Detail'];
export function auditReport(list: SlotAudit[]): Record<string, Cell>[] {
  return sortAudit(list).map(a => ({ 'When (Pakistan time)': fmtPkt(a.at), 'Who': a.by, 'Area': a.area, 'What happened': a.action, 'Country': a.country, 'About': a.ref, 'Detail': a.detail }));
}
export const NOTICE_COLUMNS = ['When (Pakistan time)', 'To', 'How', 'Status', 'Attempt', 'By'];
export function noticesReport(list: SlotNotice[]): Record<string, Cell>[] {
  return [...list].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).map(n => ({ 'When (Pakistan time)': fmtPkt(n.at), 'To': n.toName, 'How': n.channel, 'Status': n.status, 'Attempt': n.attempt, 'By': n.by }));
}

// ---------- retention: what can be cleared out, and when ----------
export const RETENTION_CHOICES = [90, 180, 365, 730] as const;
export function cutoffIso(todayIso: string, days: number): string { return addDaysIso(todayIso, -days); }

/** Cases that are finished (booked or cancelled) and older than the cut-off — safe candidates to clear. */
export function oldFinishedCases(list: SlotRequest[], cutoff: string): SlotRequest[] {
  return list.filter(x => (x.status === 'Booked' || x.status === 'Cancelled') && (x.bookedAt || x.createdAt || '9999') < cutoff);
}
export function oldAuditEntries(list: SlotAudit[], cutoff: string): SlotAudit[] {
  return list.filter(a => (a.at || '').slice(0, 10) < cutoff);
}
