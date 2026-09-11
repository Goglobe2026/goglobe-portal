import { DESTINATIONS } from './constants';

// Same mapping used in the Google Sheets sync script — kept consistent so
// a lead imported via CSV lands on the same destination bucket as one
// synced automatically.
const COUNTRY_MAP: Record<string, string> = {
  'uk': 'UK', 'united kingdom': 'UK',
  'usa': 'USA', 'us': 'USA', 'united states': 'USA',
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

export function normalizeCountry(raw: string): string {
  const first = String(raw || '').split('|')[0].trim().toLowerCase();
  if (!first) return '';
  return COUNTRY_MAP[first] || (DESTINATIONS as readonly string[]).find(d => d.toLowerCase() === first) || (first.charAt(0).toUpperCase() + first.slice(1));
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

export function normalizeImportPhone(raw: string): string {
  return String(raw || '').replace(/^p:/i, '').trim();
}

// Tries to guess which uploaded column maps to which lead field, based on
// common header naming patterns — including the exact Facebook Lead Ads
// export headers this business actually uses.
const FIELD_PATTERNS: Record<string, RegExp[]> = {
  name: [/^full_?name$/i, /^name$/i, /^client.?name$/i],
  phone: [/^phone_?number$/i, /^phone$/i, /^whatsapp$/i, /^mobile$/i],
  email: [/^email$/i],
  destination: [/desired_?country/i, /^country$/i, /^destination$/i],
  platform: [/^platform$/i, /^source$/i],
  campaign: [/^campaign_?name$/i, /^campaign$/i],
  city: [/^city$/i],
  createdTime: [/^created_?time$/i, /^date$/i],
};

export function guessColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field in FIELD_PATTERNS) {
    const patterns = FIELD_PATTERNS[field];
    const match = headers.find(h => patterns.some(p => p.test(h.trim())));
    if (match) mapping[field] = match;
  }
  return mapping;
}
