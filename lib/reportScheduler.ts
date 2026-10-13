import { runReport } from './reportRunner';

// Starts once when the server starts and checks every minute whether the daily
// report is due. Kept on globalThis so a hot reload or a second bundle cannot
// start a second timer.
const G = globalThis as unknown as { __goglobeReportTimer?: ReturnType<typeof setInterval> };

export function startReportScheduler() {
  if (G.__goglobeReportTimer) return;
  const every = Math.max(500, Number(process.env.REPORT_TICK_MS) || 60_000);
  const tick = () => { runReport({ source: 'schedule' }).catch(e => console.error('[daily-report] scheduler error', e)); };
  G.__goglobeReportTimer = setInterval(tick, every);
  setTimeout(tick, Math.min(every, 15_000)); // look once shortly after start-up too
  console.log(`[daily-report] scheduler started (checks every ${Math.round(every / 1000)}s)`);
}

// For the backup link (cron-job.org etc.) and tests.
export function runDueReport() {
  return runReport({ source: 'cron' });
}
