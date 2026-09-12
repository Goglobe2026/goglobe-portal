import { NextRequest, NextResponse } from 'next/server';
import { readCollection, writeCollection, readRaw, writeRaw } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import type { CollectionName, TeamMember, Session } from '@/lib/types';

const KNOWN_COLLECTIONS: (CollectionName | 'ceopin' | 'revenuegoal' | 'playbook' | 'sheetsyncurl')[] = [
  'leads', 'cases', 'appointments', 'team', 'transactions', 'campaigns',
  'attendance', 'ratecard', 'adjustments', 'bankaccounts', 'journalvouchers',
  'requests', 'activity', 'testimonials', 'referralagents', 'grouptours',
  'tourmembers', 'countrynotes', 'loans', 'personalexpenses', 'clientfeedback', 'marketingmaterials', 'ceopin', 'revenuegoal', 'playbook', 'sheetsyncurl',
];
const RAW_KEYS = ['ceopin', 'revenuegoal', 'playbook', 'sheetsyncurl'];

// Collections with real financial or administrative sensitivity — off
// limits entirely to a regular employee session, both reading and writing,
// even if they craft a request by hand rather than clicking through the UI.
const ADMIN_ONLY_COLLECTIONS = [
  'bankaccounts', 'loans', 'personalexpenses', 'referralagents',
  'clientfeedback', 'journalvouchers', 'ceopin', 'revenuegoal',
];

// Fields stripped from 'team' records before a non-admin ever sees them —
// covers everyone's salary, PIN, and personal details, not just their own.
const TEAM_SENSITIVE_FIELDS = [
  'pin', 'salary', 'commissionPercent', 'bonusPerClose', 'monthlyAllowance',
  'guardianName', 'guardianPhone', 'address', 'contractPdf', 'contractPdfName',
];

function requireSession(req: NextRequest): Session | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

function isAdminSession(session: Session): boolean {
  if (session.type === 'ceo') return true;
  const team = readCollection('team') as TeamMember[];
  const me = team.find(t => t.id === session.staffId);
  return !!me?.isAdmin;
}

function redactTeamForNonAdmin(team: TeamMember[], ownStaffId: string | null): Partial<TeamMember>[] {
  return team.map(t => {
    if (t.id === ownStaffId) return t; // their own full record — MyPortal needs this for "My earnings"
    const copy: any = { ...t };
    for (const f of TEAM_SENSITIVE_FIELDS) delete copy[f];
    return copy;
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { collection } = await params;
  if (!KNOWN_COLLECTIONS.includes(collection as any)) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }

  const admin = isAdminSession(session);

  if (ADMIN_ONLY_COLLECTIONS.includes(collection) && !admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (RAW_KEYS.includes(collection)) {
    const fallback = collection === 'ceopin' ? '9999' : collection === 'revenuegoal' ? '10000000' : '';
    return NextResponse.json(readRaw(collection, fallback));
  }

  if (collection === 'team' && !admin) {
    const ownId = session.type === 'employee' ? session.staffId : null;
    return NextResponse.json(redactTeamForNonAdmin(readCollection('team'), ownId));
  }

  if (collection === 'adjustments' && !admin) {
    const all = readCollection('adjustments');
    const mine = session.type === 'employee' ? all.filter(a => a.staffId === session.staffId) : [];
    return NextResponse.json(mine);
  }

  return NextResponse.json(readCollection(collection as CollectionName));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { collection } = await params;
  if (!KNOWN_COLLECTIONS.includes(collection as any)) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }

  const admin = isAdminSession(session);

  if (ADMIN_ONLY_COLLECTIONS.includes(collection) && !admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  // Salaries, PINs, and admin flags live here — only the CEO or someone
  // already granted admin access can write this collection.
  if (collection === 'team' && !admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (collection === 'adjustments' && !admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  if (RAW_KEYS.includes(collection)) {
    await writeRaw(collection, body);
  } else {
    await writeCollection(collection as CollectionName, body);
  }
  return NextResponse.json({ ok: true });
}
