import { NextRequest, NextResponse } from 'next/server';
import { readCollection } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { syncAll, syncSource } from '@/lib/sourceSync';
import type { LeadSource } from '@/lib/types';

export const dynamic = 'force-dynamic';

// "Sync now": brings in the leads of every active lead source (and any older
// plain links), or of just one source when `sourceId` is given. Any signed-in
// person may press it; the links themselves are only visible to admins.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sinceDays = Number(body?.sinceDays);
  const days = Number.isFinite(sinceDays) && sinceDays >= 0 && body?.sinceDays !== undefined && body?.sinceDays !== null ? sinceDays : undefined;

  let sheets;
  if (typeof body?.sourceId === 'string' && body.sourceId) {
    const src = (readCollection('leadsources') as LeadSource[]).find(s => s.id === body.sourceId);
    if (!src) return NextResponse.json({ error: 'That lead source no longer exists' }, { status: 404 });
    if (!src.url) return NextResponse.json({ error: 'That lead source has no sheet link yet' }, { status: 400 });
    sheets = [await syncSource(src, days)];
  } else {
    sheets = await syncAll({ sinceDays: days });
    if (!sheets.length) return NextResponse.json({ error: 'No sheet link has been set up yet' }, { status: 400 });
  }

  if (sheets.every(s => s.error)) {
    return NextResponse.json({ error: sheets[0].error, sheets }, { status: sheets[0].error?.startsWith('Google is asking') ? 403 : 502 });
  }
  const sum = (k: 'imported' | 'duplicates' | 'incomplete' | 'tooOld' | 'rows' | 'tagged') => sheets.reduce((n, s) => n + s[k], 0);
  return NextResponse.json({
    ok: true, imported: sum('imported'), duplicates: sum('duplicates'), incomplete: sum('incomplete'),
    tooOld: sum('tooOld'), totalRowsInSheet: sum('rows'), tagged: sum('tagged'), sheets,
  });
}
