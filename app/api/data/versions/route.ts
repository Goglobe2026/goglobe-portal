import { NextRequest, NextResponse } from 'next/server';
import { collectionVersion, readCollection } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import type { TeamMember } from '@/lib/types';

// One tiny request that tells a browser which lists have changed since it last
// looked (and what time the server thinks it is, so edit stamps agree between
// devices). The browser then downloads only the lists that changed.
const LISTS = [
  'leads', 'cases', 'appointments', 'team', 'transactions', 'campaigns',
  'attendance', 'ratecard', 'adjustments', 'bankaccounts', 'journalvouchers',
  'requests', 'activity', 'testimonials', 'referralagents', 'grouptours',
  'tourmembers', 'countrynotes', 'loans', 'personalexpenses', 'clientfeedback', 'marketingmaterials',
  'followuptemplates', 'invoices', 'monthlyclosings', 'payrollcategories', 'payruns', 'staffadvances',
  'complaints', 'stafftargets', 'appraisals', 'announcements', 'docregister', 'letters',
  'messages', 'qcchecks', 'leadsources',
];
const ADMIN_ONLY = [
  'bankaccounts', 'loans', 'personalexpenses', 'referralagents',
  'clientfeedback', 'journalvouchers', 'monthlyclosings', 'payrollcategories', 'staffadvances',
  'complaints', 'appraisals', 'docregister', 'letters', 'leadsources',
];

export async function GET(req: NextRequest) {
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  let admin = session.type === 'ceo';
  if (!admin) {
    const ownId = session.type === 'employee' ? session.staffId : '';
    const me = (readCollection('team') as TeamMember[]).find(t => t.id === ownId);
    admin = !!me?.isAdmin;
  }
  const versions: Record<string, number> = {};
  for (const name of LISTS) {
    if (!admin && ADMIN_ONLY.includes(name)) continue;
    versions[name] = collectionVersion(name);
  }
  return NextResponse.json({ now: Date.now(), versions }, { headers: { 'Cache-Control': 'no-store' } });
}
