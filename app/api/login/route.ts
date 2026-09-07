import { NextRequest, NextResponse } from 'next/server';
import { readRaw, readCollection } from '@/lib/store';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';
import type { TeamMember } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { mode, staffId, pin } = body || {};

  if (mode === 'ceo') {
    const ceoPin = readRaw('ceopin', '9999');
    if (pin !== ceoPin) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }
    const token = createSessionToken({ type: 'ceo' });
    const res = NextResponse.json({ ok: true, session: { type: 'ceo' } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12, // 12 hours
    });
    return res;
  }

  if (mode === 'employee') {
    const team = readCollection('team') as TeamMember[];
    const member = team.find(t => t.id === staffId);
    if (!member || pin !== member.pin) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }
    const token = createSessionToken({ type: 'employee', staffId: member.id });
    const res = NextResponse.json({ ok: true, session: { type: 'employee', staffId: member.id } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12,
    });
    return res;
  }

  return NextResponse.json({ error: 'Invalid login mode' }, { status: 400 });
}
