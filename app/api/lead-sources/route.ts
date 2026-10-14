import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { readSyncState, setSyncConfig } from '@/lib/sourceSync';

export const dynamic = 'force-dynamic';

// The Head Manager and admin staff manage lead sources; the links give access
// to the sheets, so nobody else sees them or their status.
const isAdmin = isAdminRequest;
const deny = () => NextResponse.json({ error: 'Only the Head Manager or an admin can manage lead sources.' }, { status: 403 });

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return deny();
  const st = readSyncState();
  const next = st.auto && st.lastRunAt ? new Date(Date.parse(st.lastRunAt) + st.everyMinutes * 60000).toISOString() : '';
  return NextResponse.json({ auto: st.auto, everyMinutes: st.everyMinutes, lastRunAt: st.lastRunAt, nextRunAt: next, status: st.status }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return deny();
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  if (b.everyMinutes !== undefined && !(Number(b.everyMinutes) >= 5 && Number(b.everyMinutes) <= 1440)) {
    return NextResponse.json({ error: 'Choose between every 5 minutes and once a day.' }, { status: 400 });
  }
  const st = setSyncConfig({ auto: typeof b.auto === 'boolean' ? b.auto : undefined, everyMinutes: b.everyMinutes !== undefined ? Number(b.everyMinutes) : undefined });
  return NextResponse.json({ ok: true, auto: st.auto, everyMinutes: st.everyMinutes });
}
