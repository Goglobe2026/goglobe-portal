import { NextResponse } from 'next/server';
import { readCollection } from '@/lib/store';

// Deliberately minimal: the login screen needs to show "who can sign in,"
// but a signed-out visitor should never be able to pull salaries, PINs,
// phone numbers, etc. This strips everything down to id/name/role only.
export async function GET() {
  const team = readCollection('team');
  // Only show people who can actually still sign in — someone marked
  // Resigned or Terminated shouldn't appear as a login option, even though
  // their historical records stay intact everywhere else.
  const loginable = team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave');
  const minimal = loginable.map(t => ({ id: t.id, name: t.name, role: t.role }));
  return NextResponse.json(minimal);
}
