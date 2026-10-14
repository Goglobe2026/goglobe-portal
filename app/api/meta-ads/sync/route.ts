import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { refresh, WINDOWS, type MetaWindow } from '@/lib/metaAds';

export const dynamic = 'force-dynamic';

// "Refresh": reads the campaigns and their figures from Meta now, for one time window.
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Only the Head Manager or an admin can open Ads Manager.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const w = (b?.window || 'last_30d') as MetaWindow;
  if (!WINDOWS.includes(w)) return NextResponse.json({ error: 'Unknown time period.' }, { status: 400 });
  const r = await refresh(w);
  if (!r.ok) {
    const status = r.kind === 'token' ? 401 : r.kind === 'permission' ? 403 : r.kind === 'account' ? 404 : r.kind === 'rate' ? 429 : 502;
    return NextResponse.json({ error: r.error, kind: r.kind }, { status: r.error === 'Ads Manager is not connected yet.' ? 400 : status });
  }
  return NextResponse.json({ ok: true, account: r.account, snapshot: r.snapshot }, { headers: { 'Cache-Control': 'no-store' } });
}
