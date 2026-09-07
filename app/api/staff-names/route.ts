import { NextResponse } from 'next/server';
import { readCollection } from '@/lib/store';

// Deliberately minimal: the login screen needs to show "who can sign in,"
// but a signed-out visitor should never be able to pull salaries, PINs,
// phone numbers, etc. This strips everything down to id/name/role only.
export async function GET() {
  const team = readCollection('team');
  const minimal = team.map(t => ({ id: t.id, name: t.name, role: t.role }));
  return NextResponse.json(minimal);
}
