// Runs once when the server starts. Starts the automatic WhatsApp daily report.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReportScheduler } = await import('./lib/reportScheduler');
    startReportScheduler();
  }
}
