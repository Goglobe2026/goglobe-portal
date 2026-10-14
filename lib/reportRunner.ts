import { readCollection } from './store';
import { getPerfConfig } from './perfServer';
import { readConfig, writeConfig, isReady, type ReportConfig, type HistoryItem } from './reportConfig';
import { buildDailyReport, type DailyReport, type ReportData } from './dailyReport';
import { sendReport } from './whatsapp';
import { pktNow, coverDate, dueNow, attemptsToday, remainingRecipients } from './reportSchedule';

export function loadReportData(): ReportData {
  return {
    leads: readCollection('leads'), cases: readCollection('cases'), transactions: readCollection('transactions'),
    campaigns: readCollection('campaigns'), team: readCollection('team'), attendance: readCollection('attendance'),
    appointments: readCollection('appointments'), requests: readCollection('requests'), qcChecks: readCollection('qcchecks'),
    payRuns: readCollection('payruns'), monthlyClosings: readCollection('monthlyclosings'),
    staffTargets: readCollection('stafftargets'), perfConfig: getPerfConfig(),
  };
}

export function previewReport(date: string): DailyReport {
  return buildDailyReport(date, loadReportData());
}

export interface RunOutcome {
  ok: boolean;                 // every number that was tried got the message
  skipped?: string;            // why nothing was sent (scheduled runs only)
  date: string;                // the day the report covers
  sent: number; failed: number;
  results: { name: string; last4: string; ok: boolean; error?: string }[];
}

const last4 = (phone: string) => phone.slice(-4);

// Read the newest settings, change them, save — all in one synchronous step, so
// a Head Manager editing the settings while a send is in flight is never undone.
function mutate(fn: (c: ReportConfig) => void) {
  const c = readConfig();
  fn(c);
  writeConfig(c);
}

function pushHistory(c: ReportConfig, item: HistoryItem) {
  c.history = [item, ...(c.history || [])].slice(0, 20);
}

// One entry point for everything that sends the report.
//  - 'schedule' / 'cron': sends only when it is due, retries only the numbers
//    that have not received it yet, at most 3 tries a day.
//  - 'manual': the Head Manager pressed "Send now" — goes to every number,
//    for the chosen date, and does not affect the automatic schedule.
export async function runReport(opts: { source: 'schedule' | 'cron' | 'manual'; date?: string; nowMs?: number }): Promise<RunOutcome> {
  const nowMs = opts.nowMs ?? Date.now();
  const now = pktNow(nowMs);
  let cfg = readConfig();
  const empty = (reason?: string): RunOutcome => ({ ok: false, skipped: reason, date: opts.date || coverDate(cfg, now.date), sent: 0, failed: 0, results: [] });

  let targets = cfg.recipients;
  if (opts.source !== 'manual') {
    const due = dueNow(cfg, nowMs);
    if (!due.due) return empty(due.reason);
    // Take this try's slot before doing anything slow, so a second timer tick
    // (or the backup link) arriving while we send cannot send it twice.
    const a = attemptsToday(cfg, now.date);
    cfg.attempts = { date: now.date, count: a.count + 1, lastAt: nowMs };
    writeConfig(cfg);
    targets = remainingRecipients(cfg, now.date);
  } else {
    const ready = isReady(cfg);
    if (!ready.ready) return empty(`setup incomplete — missing ${ready.missing.join(', ')}`);
  }

  const date = opts.source === 'manual' && opts.date ? opts.date : coverDate(cfg, now.date);
  const results: RunOutcome['results'] = [];
  try {
    const report = previewReport(date);
    for (const r of targets) {
      const [res] = await sendReport(cfg, report, [r]);
      results.push({ name: r.name, last4: last4(r.phone), ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
      if (res.ok && opts.source !== 'manual') mutate(c => {
        const same = c.delivered && c.delivered.date === now.date;
        c.delivered = { date: now.date, phones: [...(same ? c.delivered.phones : []), r.phone] };
      });
    }
  } catch (e) {
    console.error('[daily-report] unexpected error', e);
    results.push({ name: 'Report', last4: '', ok: false, error: `Something went wrong building the report (${(e as Error).message}).` });
  }

  const failed = results.filter(r => !r.ok).length;
  mutate(c => {
    if (opts.source !== 'manual' && !failed && results.length && remainingRecipients(c, now.date).length === 0) c.lastSentDate = now.date;
    pushHistory(c, { at: new Date(nowMs).toISOString(), source: opts.source, date, results });
  });
  if (failed) console.warn(`[daily-report] ${failed} of ${results.length} failed (${opts.source}):`, results.filter(r => !r.ok).map(r => r.error).join(' | '));
  return { ok: failed === 0 && results.length > 0, date, sent: results.length - failed, failed, results };
}
