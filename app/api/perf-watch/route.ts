import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { isAdminRequest } from '@/lib/adminAuth';
import { readPerfFile, getPerfConfig, setPerfConfig, snapshotPerf } from '@/lib/perfServer';
import { DEFAULT_PERF_CONFIG, PERF_CONFIG_KEYS, type PerfHistory, type PerfConfig } from '@/lib/perfWatch';
import { pktNow } from '@/lib/reportSchedule';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Settings and history for the Performance Watch. The numbers themselves are
// worked out on the screen from the live lists, so they are always current;
// this only supplies the thresholds and the day-by-day record.
// The Head Manager / admins get everyone's history; an employee gets only their own.
export async function GET(req: NextRequest) {
  const s = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  const admin = isAdminRequest(req);
  // Keep today's entry fresh whenever someone looks (at most every 10 minutes).
  snapshotPerf(Date.now(), 10 * 60_000);
  const f = readPerfFile();
  let history: PerfHistory = f.history;
  if (!admin && s.type === 'employee') {
    history = {};
    for (const [d, m] of Object.entries(f.history)) if (m[s.staffId]) history[d] = { [s.staffId]: m[s.staffId] };
  }
  return NextResponse.json({ today: pktNow(Date.now()).date, config: getPerfConfig(), defaults: DEFAULT_PERF_CONFIG, history, admin }, { headers: NO_STORE });
}

// Change the thresholds (Head Manager / admin only). { reset: true } goes back to the defaults.
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Only the Head Manager or an admin can change the watch settings.' }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  if (b.reset === true) return NextResponse.json({ ok: true, config: setPerfConfig(null) });
  const c = b.config;
  if (!c || typeof c !== 'object') return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  const patch: Partial<PerfConfig> = {};
  for (const k of PERF_CONFIG_KEYS) {
    if (c[k] === undefined) continue;
    const v = Number(c[k]);
    if (!Number.isFinite(v)) return NextResponse.json({ error: `“${k}” must be a number.` }, { status: 400 });
    patch[k] = v;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  const saved = setPerfConfig(patch);
  snapshotPerf(Date.now()); // the new thresholds apply to today's record straight away
  return NextResponse.json({ ok: true, config: saved });
}
