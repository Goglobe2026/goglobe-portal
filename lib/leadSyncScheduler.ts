import { runAutoIfDue } from './sourceSync';
import { runMetaIfDue } from './metaAds';
import { snapshotPerfIfDue } from './perfServer';
import { ensureQueryNos, postOutlaysIfDue } from './caseAuto';

// Starts once with the server and checks every minute whether the lead sources
// are due for their automatic pull. Kept on globalThis so a hot reload cannot
// start a second timer.
const G = globalThis as unknown as { __goglobeLeadSyncTimer?: ReturnType<typeof setInterval> };

export function startLeadSyncScheduler() {
  if (G.__goglobeLeadSyncTimer) return;
  const every = Math.max(500, Number(process.env.LEAD_SYNC_TICK_MS) || 60_000);
  const tick = () => {
    runAutoIfDue().catch(e => console.error('[lead-sync] error', e));
    runMetaIfDue().catch(e => console.error('[meta-ads] error', e));
    try { snapshotPerfIfDue(); } catch (e) { console.error('[perf-watch] error', e); }
    try { ensureQueryNos(); postOutlaysIfDue(); } catch (e) { console.error('[cases] auto error', e); }
  };
  G.__goglobeLeadSyncTimer = setInterval(tick, every);
  setTimeout(tick, Math.min(every, 20_000));
  console.log(`[lead-sync] scheduler started (checks every ${Math.round(every / 1000)}s)`);
}
