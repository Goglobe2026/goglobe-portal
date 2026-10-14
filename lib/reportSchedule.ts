import type { ReportConfig } from './reportConfig';
import { isReady } from './reportConfig';

// The "when" of the daily report, kept free of any I/O so it can be tested
// with made-up clocks. All times are Pakistan time.

export const MAX_ATTEMPTS_PER_DAY = 3;
export const RETRY_GAP_MS = 10 * 60 * 1000;

export function pktNow(ms: number): { date: string; minutes: number; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date(ms))) p[part.type] = part.value;
  const hh = Number(p.hour) % 24, mm = Number(p.minute);
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hh * 60 + mm, time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function minutesOf(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

// The day the report is about, given the day it is being sent.
export function coverDate(cfg: Pick<ReportConfig, 'covers'>, sendDay: string): string {
  return cfg.covers === 'yesterday' ? addDaysISO(sendDay, -1) : sendDay;
}

export function attemptsToday(cfg: ReportConfig, today: string): { count: number; lastAt: number } {
  return cfg.attempts && cfg.attempts.date === today ? { count: cfg.attempts.count, lastAt: cfg.attempts.lastAt } : { count: 0, lastAt: 0 };
}

export function remainingRecipients(cfg: ReportConfig, today: string) {
  const done = cfg.delivered && cfg.delivered.date === today ? cfg.delivered.phones : [];
  return cfg.recipients.filter(r => !done.includes(r.phone));
}

export type Due = { due: true } | { due: false; reason: string };

// Should the automatic send happen right now?
export function dueNow(cfg: ReportConfig, nowMs: number): Due {
  if (!cfg.enabled) return { due: false, reason: 'automatic sending is switched off' };
  const ready = isReady(cfg);
  if (!ready.ready) return { due: false, reason: `setup incomplete — missing ${ready.missing.join(', ')}` };
  const now = pktNow(nowMs);
  if (cfg.lastSentDate === now.date) return { due: false, reason: 'already sent today' };
  const at = minutesOf(cfg.sendTime);
  if (!Number.isFinite(at)) return { due: false, reason: 'send time is not valid' };
  if (now.minutes < at) return { due: false, reason: `not yet ${cfg.sendTime}` };
  if (!remainingRecipients(cfg, now.date).length) return { due: false, reason: 'everyone already has today’s report' };
  const a = attemptsToday(cfg, now.date);
  if (a.count >= MAX_ATTEMPTS_PER_DAY) return { due: false, reason: `gave up for today after ${MAX_ATTEMPTS_PER_DAY} tries` };
  if (a.lastAt && nowMs - a.lastAt < RETRY_GAP_MS) return { due: false, reason: 'waiting before trying again' };
  return { due: true };
}
