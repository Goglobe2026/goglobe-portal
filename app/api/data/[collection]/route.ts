import { NextRequest, NextResponse } from 'next/server';
import { readCollection, writeCollection, readRaw, writeRaw, mergeIntoCollection, allHaveIds, updateCollectionSync } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import type { CollectionName, TeamMember, Session, Case, PayRun, StaffTarget, TeamMessage } from '@/lib/types';
import { ensureQueryNos, numberIncoming, postOutlaysIfDue } from '@/lib/caseAuto';

const KNOWN_COLLECTIONS: (CollectionName | 'ceopin' | 'revenuegoal' | 'playbook' | 'sheetsyncurl')[] = [
  'leads', 'cases', 'appointments', 'team', 'transactions', 'campaigns',
  'attendance', 'ratecard', 'adjustments', 'bankaccounts', 'journalvouchers',
  'requests', 'activity', 'testimonials', 'referralagents', 'grouptours',
  'tourmembers', 'countrynotes', 'loans', 'personalexpenses', 'clientfeedback', 'marketingmaterials', 'followuptemplates', 'invoices', 'monthlyclosings', 'payrollcategories', 'payruns', 'staffadvances', 'complaints', 'stafftargets', 'appraisals', 'announcements', 'docregister', 'letters', 'qcchecks', 'messages', 'leadsources', 'slotwaiting', 'slotreleases', 'slotlog', 'slotalerts', 'slotnotices', 'slotaudit', 'slotconfig', 'ceopin', 'revenuegoal', 'playbook', 'sheetsyncurl',
];
const RAW_KEYS = ['ceopin', 'revenuegoal', 'playbook', 'sheetsyncurl'];

// Collections with real financial or administrative sensitivity — off
// limits entirely to a regular employee session, both reading and writing,
// even if they craft a request by hand rather than clicking through the UI.
const ADMIN_ONLY_COLLECTIONS = [
  'bankaccounts', 'loans', 'personalexpenses', 'referralagents',
  'clientfeedback', 'journalvouchers', 'ceopin', 'revenuegoal', 'monthlyclosings', 'payrollcategories', 'staffadvances',
  'complaints', 'appraisals', 'docregister', 'letters', 'leadsources', 'slotwaiting', 'slotreleases', 'slotlog', 'slotalerts', 'slotnotices', 'slotaudit', 'slotconfig',
];

// Fields stripped from 'team' records before a non-admin ever sees them —
// covers everyone's salary, PIN, and personal details, not just their own.
// Collections an employee may READ, but only their own part of — never write.
// Pay runs: only their own payslip lines, and only once the run is approved.
// Targets: only their own monthly targets.
const OWN_ONLY_READ_COLLECTIONS = ['payruns', 'stafftargets'];

const TEAM_SENSITIVE_FIELDS = [
  'pin', 'salary', 'commissionPercent', 'bonusPerClose', 'monthlyAllowance',
  'guardianName', 'guardianPhone', 'address', 'contractPdf', 'contractPdfName',
];

function requireSession(req: NextRequest): Session | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// Slot Desk lists. A staff member the Head Manager marked "Slot Desk only" may read and write exactly these, and nothing else that is admin-only.
const SLOT_COLLECTIONS = ['slotwaiting', 'slotreleases', 'slotlog', 'slotalerts', 'slotnotices', 'slotaudit', 'slotconfig'];
function isSlotOperator(session: Session): boolean {
  if (session.type !== 'employee') return false;
  const me = (readCollection('team') as TeamMember[]).find(t => t.id === session.staffId);
  return !!me?.slotDesk;
}
/** True when this caller may NOT use this admin-only list. */
function adminOnlyDenied(collection: string, admin: boolean, session: Session): boolean {
  if (!ADMIN_ONLY_COLLECTIONS.includes(collection) || admin) return false;
  return !(SLOT_COLLECTIONS.includes(collection) && isSlotOperator(session));
}

function isAdminSession(session: Session): boolean {
  if (session.type === 'ceo') return true;
  const team = readCollection('team') as TeamMember[];
  const me = team.find(t => t.id === session.staffId);
  return !!me?.isAdmin;
}

// Who is asking, for private things like messages: 'ceo' for the Head Manager,
// otherwise the team member's own id. An employee with admin access is still
// just themselves here — a private chat is private even from admins.
function identityOf(session: Session): string {
  return session.type === 'ceo' ? 'ceo' : session.staffId;
}

// What a browser is allowed to save into the messages list:
//  - a NEW message only if it is really from the caller, to someone else;
//  - a message the caller RECEIVED may only be marked as read;
//  - nothing else (other people's chats, edits to old text) is accepted.
function sanitizeMessages(incoming: TeamMessage[], stored: TeamMessage[], me: string): TeamMessage[] {
  const byId = new Map(stored.map(m => [m.id, m]));
  const known = new Set<string>(['ceo', ...(readCollection('team') as TeamMember[]).map(t => t.id)]);
  const nowMs = Date.now();
  const out: TeamMessage[] = [];
  for (const m of incoming) {
    if (!m || typeof m.id !== 'string') continue;
    const old = byId.get(m.id);
    if (!old) {
      if (m.from !== me || typeof m.to !== 'string' || m.to === me || !known.has(m.to)) continue;
      const text = typeof m.text === 'string' ? m.text.trim().slice(0, 4000) : '';
      if (!text) continue;
      const t = Date.parse(m.at);
      const at = Number.isFinite(t) && Math.abs(t - nowMs) < 10 * 60000 ? m.at : new Date(nowMs).toISOString();
      out.push({ id: m.id, from: me, to: m.to, text, at, ...(Number((m as any)._u) ? { _u: (m as any)._u } : {}) } as TeamMessage);
    } else if (old.to === me && old.from !== me) {
      if (!old.readAt) out.push({ ...old, readAt: new Date(nowMs).toISOString(), _u: Number((m as any)._u) || nowMs } as TeamMessage);
    }
  }
  return out;
}

function redactTeamForNonAdmin(team: TeamMember[], ownStaffId: string | null): Partial<TeamMember>[] {
  return team.map(t => {
    if (t.id === ownStaffId) return t; // their own full record — MyPortal needs this for "My earnings"
    const copy: any = { ...t };
    for (const f of TEAM_SENSITIVE_FIELDS) delete copy[f];
    return copy;
  });
}

// Case bonuses are other people's pay: a regular employee only ever sees
// the bonuses assigned to themselves.
function redactCasesForNonAdmin(cases: Case[], ownStaffId: string | null): Case[] {
  return cases.map(c => {
    if (!c.caseBonuses) return c;
    const mine = ownStaffId ? c.caseBonuses.filter(b => b.staffId === ownStaffId) : [];
    const copy: Case = { ...c, caseBonuses: mine };
    if (!mine.length) delete copy.caseBonuses;
    return copy;
  });
}

// When a regular employee saves cases (a manager approving a file, say),
// the closing employee, closing date and bonuses are kept exactly as stored
// — they decide who gets paid, so only an admin can change them.
function protectClosingFields(incoming: Case[], stored: Case[]): Case[] {
  const byId = new Map(stored.map(c => [c.id, c]));
  return incoming.map(c => {
    const old = byId.get(c.id);
    const copy: Case = { ...c };
    delete copy.caseBonuses;
    if (old) {
      if (old.caseBonuses) copy.caseBonuses = old.caseBonuses;
      if (old.closedBy !== undefined) copy.closedBy = old.closedBy; else delete copy.closedBy;
      if (old.closedDate !== undefined) copy.closedDate = old.closedDate; else delete copy.closedDate;
    }
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

  if (adminOnlyDenied(collection, admin, session)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  if (RAW_KEYS.includes(collection)) {
    const fallback = collection === 'ceopin' ? '9999' : collection === 'revenuegoal' ? '10000000' : '';
    return NextResponse.json(readRaw(collection, fallback));
  }

  if (collection === 'cases') { try { ensureQueryNos(); postOutlaysIfDue(); } catch (e) { console.error('[cases] auto-number error', e); } }

  if (collection === 'team' && !admin) {
    const ownId = session.type === 'employee' ? session.staffId : null;
    return NextResponse.json(redactTeamForNonAdmin(readCollection('team'), ownId));
  }

  if (collection === 'cases' && !admin) {
    const ownId = session.type === 'employee' ? session.staffId : null;
    return NextResponse.json(redactCasesForNonAdmin(readCollection('cases') as Case[], ownId));
  }

  if (collection === 'payruns' && !admin) {
    const ownId = session.type === 'employee' ? session.staffId : null;
    const runs = ownId ? (readCollection('payruns') as PayRun[]) : [];
    const mine = runs
      .filter(r => r.status !== 'Draft')
      .map(r => ({ ...r, lines: r.lines.filter(l => l.staffId === ownId).map(l => { const { notes, ...rest } = l; void notes; return rest; }) }))
      .filter(r => r.lines.length > 0);
    return NextResponse.json(mine);
  }

  if (collection === 'stafftargets' && !admin) {
    const ownId = session.type === 'employee' ? session.staffId : null;
    const all = ownId ? (readCollection('stafftargets') as StaffTarget[]) : [];
    return NextResponse.json(all.filter(x => x.staffId === ownId));
  }

  if (collection === 'messages') {
    const me = identityOf(session);
    return NextResponse.json((readCollection('messages') as TeamMessage[]).filter(m => m.from === me || m.to === me));
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

  if (adminOnlyDenied(collection, admin, session)) {
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
  if (OWN_ONLY_READ_COLLECTIONS.includes(collection) && !admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  // Everyone can read announcements; only an admin can post or change them.
  if (collection === 'announcements' && !admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  // Browsers save with { __merge: 1, items, deleted } so two people editing at
  // the same time can't overwrite each other. A plain array is still accepted
  // and replaces the whole list (used by imports and older tools).
  const isMerge = !!body && typeof body === 'object' && !Array.isArray(body) && (body as any).__merge === 1 && Array.isArray((body as any).items);
  const incoming: unknown = isMerge ? (body as any).items : body;
  const deleted: string[] = isMerge && Array.isArray((body as any).deleted) ? (body as any).deleted.filter((x: unknown) => typeof x === 'string') : [];

  if (collection === 'messages') {
    // Only careful, merge-style saves are accepted, so one person's save can
    // never replace or delete anyone else's conversations.
    if (!isMerge || !allHaveIds(incoming)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    const me = identityOf(session);
    mergeIntoCollection('messages', incoming, [], (inc, stored) => sanitizeMessages(inc as TeamMessage[], stored as TeamMessage[], me));
    return NextResponse.json({ ok: true });
  }

  if (RAW_KEYS.includes(collection)) {
    await writeRaw(collection, body);
  } else if (collection === 'cases' && !admin) {
    if (!Array.isArray(incoming)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    if (isMerge && allHaveIds(incoming)) {
      mergeIntoCollection('cases', incoming, deleted, (inc, stored) => numberIncoming(protectClosingFields(inc as Case[], stored as Case[]), stored as Case[]));
    } else {
      updateCollectionSync('cases', stored => numberIncoming(protectClosingFields(incoming as Case[], stored as Case[]), stored as Case[]) as any);
    }
  } else if (collection === 'cases' && Array.isArray(incoming)) {
    if (isMerge && allHaveIds(incoming)) {
      mergeIntoCollection('cases', incoming, deleted, (inc, stored) => numberIncoming(inc as Case[], stored as Case[]));
    } else {
      updateCollectionSync('cases', stored => numberIncoming(incoming as Case[], stored as Case[]) as any);
    }
  } else if (isMerge && allHaveIds(incoming)) {
    mergeIntoCollection(collection as CollectionName, incoming, deleted);
  } else {
    await writeCollection(collection as CollectionName, (isMerge ? incoming : body) as any);
  }
  return NextResponse.json({ ok: true });
}
