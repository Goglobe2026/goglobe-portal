import { DESTINATIONS, visaTypesFor, genId } from './constants';
import type { Lead } from './types';

// One place that knows how to turn a row from a Facebook / Instagram Lead Ads
// sheet (or any CSV with similar columns) into a portal lead. It is used by
//   - the "Sync from Google Sheet" button   (app/api/sync-sheet)
//   - the "Import CSV" window               (Leads.tsx)
//   - the automatic Google Sheets script    (POST /api/leads with a raw row)
// so a lead lands the same way no matter which door it came through.
//
// It understands both forms you have used so far:
//   - the older Schengen form  (full_name, phone_number, email, country, ...)
//   - the UK ad form           (whatsapp_number, visa interest, purpose, travel
//                               timing, profession, ...)
// and any future Facebook form: every question column it does not recognise is
// kept as a "Question: answer" line in the lead's notes, so nothing is lost.

const COUNTRY_MAP: Record<string, string> = {
  'uk': 'UK', 'united kingdom': 'UK', 'britain': 'UK', 'england': 'UK',
  'usa': 'USA', 'us': 'USA', 'united states': 'USA', 'america': 'USA',
  'canada': 'Canada',
  'australia': 'Australia',
  'schengen': 'Schengen', 'belgium': 'Schengen', 'spain': 'Schengen',
  'switzerland': 'Schengen', 'norway': 'Schengen', 'france': 'Schengen',
  'germany': 'Schengen', 'italy': 'Schengen', 'netherlands': 'Schengen',
  'turkiye': 'Türkiye', 'turkey': 'Türkiye',
  'new zealand': 'New Zealand', 'nz': 'New Zealand',
  'uae': 'UAE', 'dubai': 'UAE',
  'saudi arabia': 'Saudi Arabia', 'ksa': 'Saudi Arabia', 'saudi': 'Saudi Arabia',
  'azerbaijan': 'Azerbaijan',
  'morocco': 'Morocco',
  'malaysia': 'Malaysia',
};

// Longest names first, so "new zealand" is found before "nz" and "united
// kingdom" before "uk". "us" is left out of free-text searching on purpose
// ("how would you prefer to consult us?" must not mean USA).
const SEARCH_KEYS = Object.keys(COUNTRY_MAP).filter(k => k !== 'us').sort((a, b) => b.length - a.length);

function exactDestination(raw: string): string {
  const first = String(raw || '').split('|')[0].trim().toLowerCase();
  if (!first) return '';
  return COUNTRY_MAP[first] || (DESTINATIONS as readonly string[]).find(d => d.toLowerCase() === first) || '';
}

function destinationFromText(text: string): string {
  const t = ' ' + String(text || '').toLowerCase().replace(/[_\-–—/|,()]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  for (const key of SEARCH_KEYS) if (t.includes(' ' + key + ' ')) return COUNTRY_MAP[key];
  return '';
}

export function normalizeCountry(raw: string): string {
  const first = String(raw || '').split('|')[0].trim();
  if (!first) return '';
  const exact = exactDestination(first);
  if (exact) return exact;
  const fromText = destinationFromText(first);
  if (fromText) return fromText;
  return first.length <= 24 && !/_/.test(first) ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}

export function normalizePlatformSource(raw: string): string {
  const p = String(raw || '').trim().toLowerCase();
  if (p === 'fb' || p === 'facebook') return 'Facebook';
  if (p === 'ig' || p === 'instagram') return 'Instagram';
  if (p === 'whatsapp') return 'WhatsApp';
  if (p === 'referral') return 'Referral';
  if (p === 'walk-in' || p === 'walkin') return 'Walk-in';
  return 'Website';
}

// Tidies a phone number from a sheet. Facebook adds "p:" in front, and
// people type Pakistani numbers every which way (03xx..., 3xx..., +92 03xx...).
// Anything that is clearly a Pakistani mobile becomes +923xxxxxxxxx; numbers
// from other countries keep their own country code.
export function normalizeImportPhone(raw: string): string {
  const s = String(raw || '').replace(/^p:/i, '').trim();
  if (!s) return '';
  let d = s.replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (!s.startsWith('+') && d.startsWith('0')) {
    // local style: 03xx xxxxxxx
    if (d.length === 11 && d[1] === '3') return '+92' + d.slice(1);
    return s;
  }
  if (!s.startsWith('+') && !s.startsWith('00')) {
    if (d.length === 10 && d.startsWith('3')) return '+92' + d;
    if (!d.startsWith('92')) return s;
  }
  if (d.startsWith('920')) d = '92' + d.slice(3); // +92 0303... typed with the extra zero
  return '+' + d;
}

// What we compare to decide "is this the same phone number already in the
// portal?" — the last 10 digits, so +92 303 5030606, 0303 5030606 and
// 3035030606 all count as the same person.
export function phoneKey(p: string): string {
  const d = String(p || '').replace(/[^0-9]/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

// Facebook gives a full timestamp like "2026-10-13T11:47:31+05:00". The lead
// is stamped with the date it came in, in Pakistan time, not the day someone
// happened to press Sync.
export function extractDateOnly(raw: string, todayFallback: string): string {
  if (!raw) return todayFallback;
  const text = String(raw).trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(text) && /T|\d{1,2}:\d{2}/.test(text)) {
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  }
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  return todayFallback;
}

export function normHeader(h: string): string {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Turns machine-style answers ("uk_standard_visitor_visa", "within_1_month",
// "phone_/_whatsapp_consultatio") into something a person can read.
export function humanizeAnswer(raw: string): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  const machine = /_/.test(s) && !/\s/.test(s);
  const plainLower = /^[a-z]+$/.test(s);
  if (!machine && !plainLower) return s;
  s = s.replace(/_+/g, ' ').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();
  s = s.replace(/consultatio$/i, 'consultation'); // Facebook cuts long answers at 28 characters
  s = s.replace(/\bwhatsapp\b/gi, 'WhatsApp').replace(/\buk\b/gi, 'UK').replace(/\busa\b/gi, 'USA').replace(/\buae\b/gi, 'UAE').replace(/\bit\b/g, 'IT');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const QUESTION_LABELS: [RegExp, string][] = [
  [/visa.*interested|interested.*visa/, 'Visa interest'],
  [/purpose/, 'Purpose of visit'],
  [/when.*travel|planning_to_travel|travel_date|travel_plan/, 'Planning to travel'],
  [/travell?ed.*(before|international)|international.*before|travel_history/, 'Travelled abroad before'],
  [/prefer.*consult|consult/, 'Prefers to consult'],
  [/profession|occupation|status/, 'Profession'],
  [/desired_country|which_country/, 'Country'],
];

function questionLabel(header: string): string {
  const key = normHeader(header);
  for (const [re, label] of QUESTION_LABELS) if (re.test(key)) return label;
  const text = String(header).replace(/[?_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Columns that describe the ad / the form / the lead itself rather than being
// an answer the client gave — these never go into the notes as "questions".
const META_KEYS = new Set([
  'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
  'form_id', 'form_name', 'is_organic', 'platform', 'full_name', 'name', 'client_name',
  'phone_number', 'whatsapp_number', 'phone', 'whatsapp', 'mobile', 'mobile_number', 'email', 'city',
  'inbox_url', 'lead_status', 'portal_status', 'source', 'date', 'destination', 'country',
]);

// Tries to guess which uploaded column maps to which lead field, based on
// common header naming patterns — including the exact Facebook Lead Ads
// export headers this business uses (old Schengen form and the UK form).
const FIELD_PATTERNS: Record<string, RegExp[]> = {
  name: [/^full_?name$/i, /^name$/i, /^client.?name$/i],
  phone: [/^phone_?number$/i, /^whatsapp_?number$/i, /^whatsapp_?no/i, /^phone$/i, /^whatsapp$/i, /^mobile/i, /^contact_?number$/i],
  email: [/^email$/i, /^e-?mail/i],
  destination: [/desired_?country/i, /^country$/i, /^destination$/i, /visa.*interested/i],
  platform: [/^platform$/i, /^source$/i],
  campaign: [/^campaign_?name$/i, /^campaign$/i],
  city: [/^city$/i],
  createdTime: [/^created_?time$/i, /^date$/i],
};

export function guessColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field in FIELD_PATTERNS) {
    const patterns = FIELD_PATTERNS[field];
    const match = headers.find(h => patterns.some(p => p.test(h.trim()) || p.test(normHeader(h))));
    if (match) mapping[field] = match;
  }
  return mapping;
}

export interface BuildContext {
  existing: { phone: string; externalId?: string }[];
  todayStr: string;
  // Column choices made by the person in the CSV window; guessed when absent.
  mapping?: Record<string, string>;
  // Skip leads that came in before this date (YYYY-MM-DD).
  sinceDate?: string;
}
export interface BuildResult {
  leads: Lead[];
  duplicates: number;
  incomplete: number;
  tooOld: number;
  error?: string;
}

export function buildLeadsFromRows(headers: string[], rows: string[][], ctx: BuildContext): BuildResult {
  const out: BuildResult = { leads: [], duplicates: 0, incomplete: 0, tooOld: 0 };
  const mapping = ctx.mapping || guessColumnMapping(headers);
  const idx = (field: string) => (mapping[field] ? headers.indexOf(mapping[field]) : -1);
  const nameIdx = idx('name'), phoneIdx = idx('phone');
  if (nameIdx === -1 || phoneIdx === -1) {
    out.error = "Couldn't find a name or phone column — check the first row of the sheet has headers like full_name and whatsapp_number (or phone_number).";
    return out;
  }
  const emailIdx = idx('email'), destIdx = idx('destination'), platformIdx = idx('platform'),
    campaignIdx = idx('campaign'), cityIdx = idx('city'), createdIdx = idx('createdTime');

  const byKey = (key: string) => headers.findIndex(h => normHeader(h) === key);
  const idCol = byKey('id'), formCol = byKey('form_name'), adCol = byKey('ad_name'), campCol = byKey('campaign_name'),
    inboxCol = byKey('inbox_url');
  const mappedCols = new Set([nameIdx, phoneIdx, emailIdx, destIdx, platformIdx, campaignIdx, cityIdx, createdIdx].filter(i => i > -1));

  const seenPhones = new Set(ctx.existing.map(l => phoneKey(l.phone)));
  const seenExternal = new Set(ctx.existing.map(l => l.externalId).filter(Boolean) as string[]);

  for (const row of rows) {
    const name = (row[nameIdx] || '').trim();
    const phone = normalizeImportPhone(row[phoneIdx] || '');
    if (!name || !phone) { out.incomplete++; continue; }

    const externalId = idCol > -1 ? (row[idCol] || '').trim() : '';
    if (externalId && seenExternal.has(externalId)) { out.duplicates++; continue; }
    const key = phoneKey(phone);
    if (seenPhones.has(key)) { out.duplicates++; continue; }

    const createdAt = createdIdx > -1 ? extractDateOnly(row[createdIdx], ctx.todayStr) : ctx.todayStr;
    if (ctx.sinceDate && createdAt < ctx.sinceDate) { out.tooOld++; continue; }

    seenPhones.add(key);
    if (externalId) seenExternal.add(externalId);

    // Destination: the country column if the form has one, otherwise what visa
    // they said they want, otherwise what the form / campaign / ad is called.
    const rawDest = destIdx > -1 ? (row[destIdx] || '') : '';
    const destination =
      exactDestination(rawDest) || destinationFromText(rawDest) ||
      destinationFromText(formCol > -1 ? row[formCol] : '') ||
      destinationFromText(campCol > -1 ? row[campCol] : '') ||
      destinationFromText(adCol > -1 ? row[adCol] : '') ||
      normalizeCountry(rawDest);

    const visaText = String(rawDest).toLowerCase();
    let visaType = '';
    if (destination) {
      const types = visaTypesFor(destination);
      if (/business/.test(visaText) && types.includes('Business')) visaType = 'Business';
      else if (/visit|tourist|tourism|visitor/.test(visaText) && types.includes('Tourist')) visaType = 'Tourist';
    }

    // Everything the client answered becomes a readable line in the notes.
    const lines: string[] = [];
    if (emailIdx > -1 && row[emailIdx]) lines.push(`Email: ${row[emailIdx]}`);
    if (cityIdx > -1 && row[cityIdx]) lines.push(`City: ${row[cityIdx]}`);
    let occupation = '';
    headers.forEach((h, i) => {
      if (mappedCols.has(i)) {
        if (i === destIdx && normHeader(h).match(/visa.*interested/) && row[i]) lines.push(`${questionLabel(h)}: ${humanizeAnswer(row[i])}`);
        return;
      }
      const k = normHeader(h);
      if (!k || META_KEYS.has(k) || k === 'lead_status') return;
      const val = (row[i] || '').trim();
      if (!val) return;
      const label = questionLabel(h);
      const nice = humanizeAnswer(val);
      if (label === 'Profession' && !occupation) occupation = nice;
      lines.push(`${label}: ${nice}`);
    });
    if (inboxCol > -1 && row[inboxCol]) lines.push(`Facebook chat: ${row[inboxCol].trim()}`);

    out.leads.push({
      id: genId('ld'),
      externalId: externalId || undefined,
      name, phone,
      source: platformIdx > -1 ? normalizePlatformSource(row[platformIdx]) : 'Website',
      campaign: campaignIdx > -1 ? (row[campaignIdx] || '') : '',
      destination, visaType, stage: 'New', assignedTo: '', createdAt,
      notes: lines.join('\n'), messages: [], nextFollowUp: ctx.todayStr, lastContacted: '',
      escalated: false, escalationReason: '', escalationResolved: false, lostReason: '',
      interestLevel: 'Unrated', isVip: false, occupation, lastEngagementSent: '',
    });
  }
  return out;
}

// Accepts the normal address-bar link of a Google Sheet (with ?gid=... for the
// tab) or a "Publish to web" link, and returns the address that gives back CSV.
export function sheetCsvUrl(input: string, base = 'https://docs.google.com'): { url?: string; error?: string } {
  const text = String(input || '').trim();
  if (!text) return { error: 'Empty link' };
  let u: URL;
  try { u = new URL(text); } catch { return { error: "That doesn't look like a link" }; }
  if (u.hostname !== 'docs.google.com' && u.hostname !== 'sheets.google.com') return { error: 'Only Google Sheets links can be used here' };
  const published = u.pathname.match(/^\/spreadsheets\/d\/e\/([A-Za-z0-9_-]+)\/pub/);
  if (published) {
    const q = new URLSearchParams(u.search);
    q.set('output', 'csv');
    return { url: `${base}${u.pathname}?${q.toString()}` };
  }
  const m = u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!m) return { error: "That doesn't look like a Google Sheets link" };
  const gid = (u.hash.match(/gid=(\d+)/) || u.search.match(/[?&]gid=(\d+)/) || [])[1] || '0';
  return { url: `${base}/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}` };
}
