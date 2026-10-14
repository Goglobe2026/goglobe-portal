// Runs once when the server starts. Starts the automatic WhatsApp daily report
// and the automatic pull of the lead sources.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReportScheduler } = await import('./lib/reportScheduler');
    startReportScheduler();
    const { startLeadSyncScheduler } = await import('./lib/leadSyncScheduler');
    startLeadSyncScheduler();
  }
}
