import { NextRequest, NextResponse } from 'next/server';
import { readCollection, writeCollection, readRaw } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { parseCsv } from '@/lib/csv';
import { normalizeCountry, normalizePlatformSource, normalizeImportPhone, guessColumnMapping } from '@/lib/leadImport';
import { today } from '@/lib/constants';
import type { Lead } from '@/lib/types';

function normalizePhoneForDupeCheck(p: string) {
  return (p || '').replace(/[^0-9]/g, '').replace(/^92/, '0');
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = readRaw('sheetsyncurl', '');
  if (!url) return NextResponse.json({ error: 'No sheet link has been set up yet' }, { status: 400 });

  let csvText: string;
  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: `Couldn't reach that sheet (HTTP ${res.status}) — check the link is still set to "Anyone with the link"` }, { status: 502 });
    csvText = await res.text();
  } catch {
    return NextResponse.json({ error: "Couldn't reach that sheet — check the link is correct and published" }, { status: 502 });
  }

  const { headers, rows } = parseCsv(csvText);
  if (!headers.length) return NextResponse.json({ error: 'That link didn\'t return any readable data' }, { status: 400 });

  const mapping = guessColumnMapping(headers);
  const nameIdx = mapping.name ? headers.indexOf(mapping.name) : -1;
  const phoneIdx = mapping.phone ? headers.indexOf(mapping.phone) : -1;
  if (nameIdx === -1 || phoneIdx === -1) {
    return NextResponse.json({ error: "Couldn't find a name or phone column in that sheet — check the column headers match what's expected" }, { status: 400 });
  }
  const emailIdx = mapping.email ? headers.indexOf(mapping.email) : -1;
  const destIdx = mapping.destination ? headers.indexOf(mapping.destination) : -1;
  const platformIdx = mapping.platform ? headers.indexOf(mapping.platform) : -1;
  const campaignIdx = mapping.campaign ? headers.indexOf(mapping.campaign) : -1;
  const cityIdx = mapping.city ? headers.indexOf(mapping.city) : -1;

  const existingLeads = readCollection('leads') as Lead[];
  const seenPhones = new Set(existingLeads.map(l => normalizePhoneForDupeCheck(l.phone)));

  const newLeads: Lead[] = [];
  let duplicates = 0, incomplete = 0;

  for (const row of rows) {
    const name = row[nameIdx]?.trim();
    const rawPhone = normalizeImportPhone(row[phoneIdx] || '');
    if (!name || !rawPhone) { incomplete++; continue; }
    const normalized = normalizePhoneForDupeCheck(rawPhone);
    if (seenPhones.has(normalized)) { duplicates++; continue; }
    seenPhones.add(normalized);

    const noteParts: string[] = [];
    if (emailIdx > -1 && row[emailIdx]) noteParts.push(`Email: ${row[emailIdx]}`);
    if (cityIdx > -1 && row[cityIdx]) noteParts.push(`City: ${row[cityIdx]}`);

    newLeads.push({
      id: `ld_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name, phone: rawPhone,
      source: platformIdx > -1 ? normalizePlatformSource(row[platformIdx]) : 'Website',
      campaign: campaignIdx > -1 ? (row[campaignIdx] || '') : '',
      destination: destIdx > -1 ? normalizeCountry(row[destIdx]) : '',
      visaType: '', stage: 'New', assignedTo: '', createdAt: today(),
      notes: noteParts.join(' · '), messages: [], nextFollowUp: today(), lastContacted: '',
      escalated: false, escalationReason: '', escalationResolved: false, lostReason: '',
    });
  }

  if (newLeads.length) {
    await writeCollection('leads', [...existingLeads, ...newLeads]);
  }

  return NextResponse.json({ ok: true, imported: newLeads.length, duplicates, incomplete, totalRowsInSheet: rows.length });
}
