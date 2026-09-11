import { NextRequest, NextResponse } from 'next/server';
import { readCollection, writeCollection } from '@/lib/store';
import { genId, today } from '@/lib/constants';
import type { Lead } from '@/lib/types';

// This is the one endpoint your public website (and now your Google Sheets
// sync) is allowed to call without being logged in — it's how a customer's
// form submission or a Facebook lead becomes a real lead in the portal
// instead of sitting in a spreadsheet nobody follows up on.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, phone, destination, visaType, message, source, campaign } = body || {};

  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
  }

  const lead: Lead = {
    id: genId('ld'),
    name: String(name).slice(0, 200),
    phone: String(phone).slice(0, 40),
    destination: destination ? String(destination).slice(0, 60) : '',
    visaType: visaType ? String(visaType).slice(0, 60) : '',
    notes: message ? String(message).slice(0, 2000) : '',
    source: source ? String(source).slice(0, 60) : 'Website',
    campaign: campaign ? String(campaign).slice(0, 200) : '',
    stage: 'New',
    assignedTo: '',
    createdAt: today(),
    messages: [],
    nextFollowUp: today(),
    lastContacted: '',
    escalated: false,
    escalationReason: '',
    escalationResolved: false,
    lostReason: '',
  };

  const leads = readCollection('leads');
  leads.push(lead);
  await writeCollection('leads', leads);

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}
