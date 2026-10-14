import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { readConfig } from '@/lib/reportConfig';
import { runDueReport } from '@/lib/reportScheduler';

export const dynamic = 'force-dynamic';

// A backup way to start the daily report: any free "cron" website can open
// this link every few minutes. It does nothing unless the report is due, so
// calling it often is harmless. Needed only if the server is asleep at send time.
export async function GET(req: NextRequest) {
  const given = req.nextUrl.searchParams.get('key') || '';
  const want = readConfig().cronKey;
  const a = Buffer.from(given), b = Buffer.from(want);
  if (!want || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const out = await runDueReport();
  return NextResponse.json({ ok: out.ok, skipped: out.skipped || null, sent: out.sent, failed: out.failed });
}
