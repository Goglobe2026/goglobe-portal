import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { runReport } from '@/lib/reportRunner';
import { readConfig, isReady } from '@/lib/reportConfig';

export const dynamic = 'force-dynamic';

// "Send now": goes to every saved number, for the chosen date.
export async function POST(req: NextRequest) {
  const s = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || s.type !== 'ceo') return NextResponse.json({ error: 'Only the Head Manager can send the daily report.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const date = typeof b?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : undefined;
  const ready = isReady(readConfig());
  if (!ready.ready) return NextResponse.json({ error: `Setup is not finished — you still need ${ready.missing.join(', ')}.` }, { status: 400 });
  const out = await runReport({ source: 'manual', date });
  return NextResponse.json(out);
}
