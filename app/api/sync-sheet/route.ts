import { NextRequest, NextResponse } from 'next/server';
import { updateCollectionSync, readRaw } from '@/lib/store';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { parseCsv } from '@/lib/csv';
import { buildLeadsFromRows, sheetCsvUrl } from '@/lib/leadImport';
import { today } from '@/lib/constants';
import { ensureCampaignsFor } from '@/lib/campaignAuto';
import type { Lead } from '@/lib/types';

interface SheetResult { label: string; rows: number; imported: number; duplicates: number; incomplete: number; tooOld: number; error?: string }

function daysAgo(n: number) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sinceDays = Number(body?.sinceDays);
  const sinceDate = Number.isFinite(sinceDays) && sinceDays > 0 ? daysAgo(sinceDays) : undefined;

  // One link per line — you can keep the UK ad sheet and an older sheet side by side.
  const links = readRaw('sheetsyncurl', '').split(/\s*\n\s*/).map(s => s.trim()).filter(Boolean);
  if (!links.length) return NextResponse.json({ error: 'No sheet link has been set up yet' }, { status: 400 });

  const base = process.env.SHEETS_TEST_BASE || 'https://docs.google.com';
  const sheets: SheetResult[] = [];

  for (const link of links) {
    const result: SheetResult = { label: link.slice(0, 60), rows: 0, imported: 0, duplicates: 0, incomplete: 0, tooOld: 0 };
    sheets.push(result);

    const conv = sheetCsvUrl(link, base);
    if (!conv.url) { result.error = conv.error || 'Not a usable link'; continue; }

    let csvText = '';
    try {
      const res = await fetch(conv.url, { signal: AbortSignal.timeout(25000) });
      if (!res.ok) {
        result.error = res.status === 404 || res.status === 400
          ? "Google couldn't find that sheet or tab — check the link is complete."
          : `Couldn't reach that sheet (HTTP ${res.status}).`;
        continue;
      }
      csvText = await res.text();
    } catch {
      result.error = "Couldn't reach that sheet — check the link is correct.";
      continue;
    }

    // A private sheet answers with a Google sign-in web page, not data.
    if (/^\s*<(!doctype|html)/i.test(csvText)) {
      result.error = 'Google is asking for a sign-in — open the sheet, press Share, and under General access choose "Anyone with the link" (Viewer). Then sync again.';
      continue;
    }

    const { headers, rows } = parseCsv(csvText);
    if (!headers.length) { result.error = "That link didn't return any readable data."; continue; }
    result.rows = rows.length;

    // Name the sheet after its form ("UK form") when it has one.
    const formCol = headers.findIndex(h => h.trim().toLowerCase() === 'form_name');
    const formName = formCol > -1 ? (rows.find(r => (r[formCol] || '').trim())?.[formCol] || '').trim() : '';
    if (formName) result.label = formName;

    let fresh: Lead[] = [];
    updateCollectionSync('leads', current => {
      const built = buildLeadsFromRows(headers, rows, { existing: current, todayStr: today(), sinceDate });
      if (built.error) { result.error = built.error; return current; }
      result.imported = built.leads.length; result.duplicates = built.duplicates; result.incomplete = built.incomplete; result.tooOld = built.tooOld;
      fresh = built.leads;
      return built.leads.length ? [...current, ...built.leads] : current;
    });
    ensureCampaignsFor(fresh);
  }

  if (sheets.every(s => s.error)) {
    return NextResponse.json({ error: sheets[0].error, sheets }, { status: sheets[0].error?.startsWith('Google is asking') ? 403 : 502 });
  }

  const sum = (k: 'imported' | 'duplicates' | 'incomplete' | 'tooOld' | 'rows') => sheets.reduce((n, s) => n + s[k], 0);
  return NextResponse.json({
    ok: true, imported: sum('imported'), duplicates: sum('duplicates'), incomplete: sum('incomplete'),
    tooOld: sum('tooOld'), totalRowsInSheet: sum('rows'), sheets,
  });
}
