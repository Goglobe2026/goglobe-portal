import { NextRequest, NextResponse } from 'next/server';
import { readCollection, writeCollection, readRaw, writeRaw } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import type { CollectionName } from '@/lib/types';

const KNOWN_COLLECTIONS: (CollectionName | 'ceopin' | 'revenuegoal')[] = [
  'leads', 'cases', 'appointments', 'team', 'transactions', 'campaigns',
  'attendance', 'ratecard', 'adjustments', 'bankaccounts', 'journalvouchers',
  'requests', 'activity', 'testimonials', 'referralagents', 'grouptours',
  'tourmembers', 'countrynotes', 'loans', 'personalexpenses', 'ceopin', 'revenuegoal',
];
const RAW_KEYS = ['ceopin', 'revenuegoal'];

function requireSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const session = requireSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { collection } = await params;
  if (!KNOWN_COLLECTIONS.includes(collection as any)) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 404 });
  }
  if (RAW_KEYS.includes(collection)) {
    const fallback = collection === 'ceopin' ? '9999' : '10000000';
    return NextResponse.json(readRaw(collection, fallback));
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
  const body = await req.json().catch(() => null);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  if (RAW_KEYS.includes(collection)) {
    await writeRaw(collection, body);
  } else {
    await writeCollection(collection as CollectionName, body);
  }
  return NextResponse.json({ ok: true });
}
