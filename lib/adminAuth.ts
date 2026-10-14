import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from './session';
import { readCollection } from './store';
import type { TeamMember } from './types';

// The Head Manager, or a staff member the Head Manager made an admin.
export function isAdminRequest(req: NextRequest): boolean {
  const s = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return false;
  if (s.type === 'ceo') return true;
  const me = (readCollection('team') as TeamMember[]).find(t => t.id === s.staffId);
  return !!me?.isAdmin;
}
