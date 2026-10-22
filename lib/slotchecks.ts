import type { SlotAlert, SlotAudit, SlotConfig } from './types';
import { WINDOW_LABELS } from './slotdesk';
import { configFor, sourceHealth, type SourceHealth } from './slotalerts';

// The check round: one person walks through the official pages a few times a day, taps what she sees, and the
// portal does the paperwork (marks the page checked, files the alert, writes the audit line). Nothing here reads
// a website. The portal only reminds, orders the pages, and counts what people reported.

/** The audit lines a check round writes. The check history is read back from them, so the wording must stay stable. */
export const CHECK_ACTION = {
  none: 'Check round: nothing open',
  seen: 'Check round: dates showing',
  down: 'Check round: page not opening',
} as const;
export type CheckOutcome = keyof typeof CHECK_ACTION;

export const EVERY_CHOICES = [1, 2, 3, 4, 6, 12, 24] as const;

// ---------- which pages, in which order ----------
export interface RoundItem { country: string; state: SourceHealth['state']; hoursSince: number | null }
const RANK: Record<SourceHealth['state'], number> = { 'Never checked': 0, Overdue: 1, Due: 2, Fresh: 3, Paused: 9 };

/** Pages that are switched on, the ones furthest behind first. Paused countries are left out. */
export function roundOrder(countries: readonly string[], configs: SlotConfig[], alerts: SlotAlert[], nowMs: number): RoundItem[] {
  return countries
    .map((country, i) => { const h = sourceHealth(country, configFor(configs, country), alerts, nowMs); return { country, state: h.state, hoursSince: h.hoursSince, i }; })
    .filter(x => x.state !== 'Paused')
    .sort((a, b) => RANK[a.state] - RANK[b.state] || (b.hoursSince ?? 1e9) - (a.hoursSince ?? 1e9) || a.i - b.i)
    .map(({ country, state, hoursSince }) => ({ country, state, hoursSince }));
}

/** Countries whose official page is due to be looked at (never checked, or not looked at for longer than the chosen interval). */
export function dueCountries(countries: readonly string[], configs: SlotConfig[], alerts: SlotAlert[], nowMs: number): string[] {
  return roundOrder(countries, configs, alerts, nowMs).filter(r => r.state === 'Never checked' || r.state === 'Overdue' || r.state === 'Due').map(r => r.country);
}

// ---------- reminders ----------
export const REMIND_FROM_HOUR = 9;      // Pakistan time: no nagging before 9 am …
export const REMIND_TO_HOUR = 20;       // … or from 8 pm
export const REMIND_GAP_MIN = 30;       // and at most one reminder every half hour

export function inReminderHours(nowMs: number): boolean {
  const h = new Date(nowMs + 5 * 3600 * 1000).getUTCHours();
  return h >= REMIND_FROM_HOUR && h < REMIND_TO_HOUR;
}
/** Time for another reminder? `lastMs` is when the last one was shown (NaN or 0 when never). */
export function shouldRemind(dueCount: number, lastMs: number, nowMs: number): boolean {
  if (dueCount <= 0 || !inReminderHours(nowMs)) return false;
  return !Number.isFinite(lastMs) || lastMs <= 0 || nowMs - lastMs >= REMIND_GAP_MIN * 60000;
}
export function reminderText(due: string[]): string {
  if (!due.length) return '';
  const names = due.length <= 3 ? due.join(', ') : `${due.slice(0, 3).join(', ')} and ${due.length - 3} more`;
  return `Time to look at the official page${due.length === 1 ? '' : 's'}: ${names}. Open Slot Desk → Start check round.`;
}

// ---------- what the checks found (read back from the audit trail) ----------
export interface CheckEvent { atMs: number; country: string; outcome: CheckOutcome; by: string }
const OUTCOME_OF: Record<string, CheckOutcome> = Object.fromEntries((Object.keys(CHECK_ACTION) as CheckOutcome[]).map(k => [CHECK_ACTION[k], k]));

export function checksFromAudit(audit: SlotAudit[]): CheckEvent[] {
  const out: CheckEvent[] = [];
  for (const a of audit) {
    const outcome = OUTCOME_OF[a.action]; const at = Date.parse(a.at);
    if (outcome && Number.isFinite(at)) out.push({ atMs: at, country: a.country || '', outcome, by: a.by || '' });
  }
  return out.sort((a, b) => a.atMs - b.atMs);
}

export interface WindowStat { label: string; checks: number; seen: number }
export interface CheckStats {
  checks: number; seen: number; down: number;
  seenRate: number | null;                  // % of the checks where the page opened and dates were showing
  windows: WindowStat[]; best: WindowStat | null; enough: boolean;
}
export const MIN_CHECKS_FOR_PATTERN = 10;

export function checkStats(audit: SlotAudit[], nowMs: number, days = 14, country = ''): CheckStats {
  const from = nowMs - days * 86400000;
  const ev = checksFromAudit(audit).filter(e => e.atMs >= from && e.atMs <= nowMs + 60000 && (!country || e.country === country));
  const windows: WindowStat[] = WINDOW_LABELS.map(label => ({ label, checks: 0, seen: 0 }));
  let seen = 0, down = 0;
  for (const e of ev) {
    if (e.outcome === 'down') { down++; continue; }                              // a page that would not open says nothing about dates
    const h = new Date(e.atMs + 5 * 3600 * 1000).getUTCHours();
    const w = windows[Math.floor(h / 3)];
    w.checks++;
    if (e.outcome === 'seen') { w.seen++; seen++; }
  }
  const readable = ev.length - down;
  const best = windows.filter(w => w.seen > 0).sort((a, b) => b.seen - a.seen || b.seen / b.checks - a.seen / a.checks || a.checks - b.checks)[0] || null;
  return { checks: ev.length, seen, down, seenRate: readable > 0 ? Math.round((seen / readable) * 100) : null, windows, best, enough: ev.length >= MIN_CHECKS_FOR_PATTERN };
}
