import { NextRequest, NextResponse } from 'next/server';
import { updateCollectionSync } from '@/lib/store';
import { genId, today } from '@/lib/constants';
import { buildLeadsFromRows } from '@/lib/leadImport';
import { ensureCampaignsFor } from '@/lib/campaignAuto';
import type { Lead } from '@/lib/types';

// This is the one endpoint your public website (and your Google Sheets sync
// script) is allowed to call without being logged in — it's how a customer's
// form submission or a Facebook lead becomes a real lead in the portal
// instead of sitting in a spreadsheet nobody follows up on.
//
// Two ways to call it:
//  1. the simple way, used by the website contact form:
//       { name, phone, destination, visaType, message, source, campaign }
//  2. the sheet way, used by the Google Sheets script — send the sheet row as
//       { row: { full_name: "...", whatsapp_number: "...", ... } }
//     and the portal works out the rest (same rules as "Sync from Google
//     Sheet"). A lead that is already in the portal is answered with 200 and
//     { duplicate: true } instead of being added twice.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body && typeof body.row === 'object' && body.row) {
    const headers = Object.keys(body.row);
    const values = headers.map(h => String(body.row[h] ?? ''));
    let result: ReturnType<typeof buildLeadsFromRows> | null = null;
    updateCollectionSync('leads', current => {
      result = buildLeadsFromRows(headers, [values], { existing: current, todayStr: today() });
      return result.leads.length ? [...current, ...result.leads] : current;
    });
    const r = result as unknown as ReturnType<typeof buildLeadsFromRows>;
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    if (r.leads.length) { ensureCampaignsFor(r.leads); return NextResponse.json({ ok: true, lead: r.leads[0] }, { status: 201 }); }
    if (r.duplicates) return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
  }

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
    interestLevel: 'Unrated',
    isVip: false,
    occupation: '',
    lastEngagementSent: '',
  };

  updateCollectionSync('leads', current => [...current, lead]);
  ensureCampaignsFor([lead]);

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}
