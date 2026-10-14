import { NextRequest, NextResponse } from 'next/server';
import { readRaw, readCollection, writeCollection } from '@/lib/store';
import { createSessionToken, SESSION_COOKIE } from '@/lib/session';
import { today } from '@/lib/constants';
import { isLockedOut, recordFailedAttempt, clearAttempts } from '@/lib/lockout';
import type { TeamMember, AttendanceRecord } from '@/lib/types';

function nowTimeStr() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
}

// Records the employee's first login of the day as their check-in time,
// automatically — no separate "check in" button needed. Only fires once per
// day per person: if they've already got a check-in today, logging in again
// (e.g. from their phone later) doesn't overwrite the original time.
async function recordLoginAttendance(staffId: string) {
  const attendance = readCollection('attendance') as AttendanceRecord[];
  const already = attendance.find(a => a.staffId === staffId && a.date === today());
  if (already) return;
  attendance.push({
    id: `at_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    staffId, date: today(), checkIn: nowTimeStr(), checkOut: '', onApprovedLeave: false,
  });
  await writeCollection('attendance', attendance);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { mode, staffId, pin } = body || {};

  if (mode === 'ceo') {
    const lockKey = 'ceo';
    const lockedMinutes = isLockedOut(lockKey);
    if (lockedMinutes) {
      return NextResponse.json({ error: `Too many wrong PINs. Try again in ${lockedMinutes} minute(s).` }, { status: 429 });
    }
    const ceoPin = readRaw('ceopin', '9999');
    if (pin !== ceoPin) {
      recordFailedAttempt(lockKey);
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }
    clearAttempts(lockKey);
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
    const lockKey = `emp:${staffId}`;
    const lockedMinutes = isLockedOut(lockKey);
    if (lockedMinutes) {
      return NextResponse.json({ error: `Too many wrong PINs. Try again in ${lockedMinutes} minute(s).` }, { status: 429 });
    }
    const team = readCollection('team') as TeamMember[];
    const member = team.find(t => t.id === staffId);
    if (!member || pin !== member.pin) {
      recordFailedAttempt(lockKey);
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }
    if (member.employmentStatus === 'Resigned' || member.employmentStatus === 'Terminated') {
      return NextResponse.json({ error: 'This account is no longer active' }, { status: 401 });
    }
    clearAttempts(lockKey);
    await recordLoginAttendance(member.id);
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
