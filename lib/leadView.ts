import type { Lead } from './types';

// Everything the Leads screen needs to decide, kept apart from the screen so it
// can be tested on its own: which country tab a lead belongs to, which leads are
// "new", the newest-first order, and the numbers on the dashboard.

export type CountryGroup = 'UK' | 'Schengen' | 'Other';
export const GROUPS: CountryGroup[] = ['UK', 'Schengen', 'Other'];

// UK is the priority market, then Schengen, then everything else.
export function groupOf(l: Pick<Lead, 'destination'>): CountryGroup {
  const d = (l.destination || '').trim().toLowerCase();
  if (d === 'uk') return 'UK';
  if (d === 'schengen') return 'Schengen';
  return 'Other';
}
export const groupRank = (g: CountryGroup) => GROUPS.indexOf(g);
export const isClosed = (l: Pick<Lead, 'stage'>) => l.stage === 'Converted' || l.stage === 'Lost';

// "New" = nobody has touched it yet (stage New) and it came in during the last 48 hours.
export const FRESH_HOURS = 48;
export function dayBefore(dateStr: string, days = 1): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
export function isFresh(l: Lead, nowMs: number, todayStr: string): boolean {
  if (l.stage !== 'New') return false;
  if (l.receivedAt) {
    const t = Date.parse(l.receivedAt);
    if (!isNaN(t)) return nowMs - t <= FRESH_HOURS * 3600000;
  }
  return !!l.createdAt && l.createdAt >= dayBefore(todayStr, 1);
}

// Follow-up state: before today = overdue, today = due today.
export function followState(l: Lead, todayStr: string): 'overdue' | 'today' | 'later' | 'none' {
  if (isClosed(l) || !l.nextFollowUp) return 'none';
  if (l.nextFollowUp < todayStr) return 'overdue';
  if (l.nextFollowUp === todayStr) return 'today';
  return 'later';
}
export const isDue = (l: Lead, todayStr: string) => { const s = followState(l, todayStr); return s === 'overdue' || s === 'today'; };

// The city the client wrote on the ad form (kept as its own field, or as a "City: …" line in older leads).
export function cityOf(l: Pick<Lead, 'city' | 'notes'>): string {
  if (l.city) return l.city;
  const m = /^City:\s*(.+)$/im.exec(l.notes || '');
  return m ? m[1].trim() : '';
}

// ---------- order ----------
// Newest first. The day decides first; inside one day the exact time is used when
// both leads have it; otherwise the lead that was added later in the list is newer.
export function compareNewest(a: { l: Lead; i: number }, b: { l: Lead; i: number }): number {
  const da = a.l.createdAt || '', db = b.l.createdAt || '';
  if (da !== db) return da < db ? 1 : -1;
  if (a.l.receivedAt && b.l.receivedAt && a.l.receivedAt !== b.l.receivedAt) return a.l.receivedAt < b.l.receivedAt ? 1 : -1;
  return b.i - a.i;
}
export function sortNewest(leads: Lead[], opts: { ukFirst?: boolean } = {}): Lead[] {
  return leads.map((l, i) => ({ l, i })).sort((a, b) => {
    if (opts.ukFirst) {
      const ga = groupRank(groupOf(a.l)), gb = groupRank(groupOf(b.l));
      if (ga !== gb) return ga - gb;
    }
    return compareNewest(a, b);
  }).map(x => x.l);
}

// ---------- looks ----------
export const THEME = {
  navy: '#17365D', teal: '#2E6F78', navyDark: '#10294A',
  uk: { bg: '#FFF1CC', fg: '#7A5200', line: '#E8C766', solid: '#C9922E' },
  schengen: { bg: '#D8EEF0', fg: '#1F5A62', line: '#9CCDD3', solid: '#2E6F78' },
  other: { bg: '#E6ECF5', fg: '#35527A', line: '#B9C8DE', solid: '#6B86AD' },
  fresh: { bg: '#E3F6EC', line: '#1FA463', fg: '#0B6E4F' },
  overdue: { bg: '#FCEEEC', fg: '#B5433A' },
  vip: { bg: '#FFF8E1' },
};
export const groupLook = (g: CountryGroup) => (g === 'UK' ? THEME.uk : g === 'Schengen' ? THEME.schengen : THEME.other);

// Status colours, as in the Go Globe sheet: New Lead light blue, Follow-up yellow.
export const STATUS_LOOK: Record<Lead['stage'], { bg: string; fg: string; label: string }> = {
  New: { bg: '#DDEBF7', fg: '#1F4E79', label: 'New' },
  Contacted: { bg: '#FFF2CC', fg: '#7F6000', label: 'Contacted' },
  Qualified: { bg: '#E4DDF4', fg: '#4B2E83', label: 'Qualified' },
  Converted: { bg: '#C6EFCE', fg: '#1E6B34', label: 'Converted' },
  Lost: { bg: '#EDEDED', fg: '#6B6B6B', label: 'Lost' },
};

// "5 min ago", "3 h ago", "Yesterday", "12 Oct".
export function agoText(l: Pick<Lead, 'receivedAt' | 'createdAt'>, nowMs: number, todayStr: string): string {
  if (l.receivedAt) {
    const t = Date.parse(l.receivedAt);
    if (!isNaN(t)) {
      const mins = Math.max(0, Math.round((nowMs - t) / 60000));
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins} min ago`;
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return `${hrs} h ago`;
    }
  }
  const c = l.createdAt || '';
  if (!c) return '';
  if (c === todayStr) return 'Today';
  if (c === dayBefore(todayStr, 1)) return 'Yesterday';
  const d = new Date(c + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

// ---------- dashboard numbers ----------
export interface GroupStats {
  group: CountryGroup;
  total: number; fresh: number; waiting: number; contacted: number; qualified: number;
  converted: number; lost: number; due: number; overdue: number; unassigned: number; open: number;
  conversionPct: number;
  latest: string;           // newest lead's receivedAt or createdAt ('' if none)
  last7: number;
}
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export function groupStats(leads: Lead[], nowMs: number, todayStr: string): Record<CountryGroup, GroupStats> {
  const blank = (group: CountryGroup): GroupStats => ({ group, total: 0, fresh: 0, waiting: 0, contacted: 0, qualified: 0, converted: 0, lost: 0, due: 0, overdue: 0, unassigned: 0, open: 0, conversionPct: 0, latest: '', last7: 0 });
  const out: Record<CountryGroup, GroupStats> = { UK: blank('UK'), Schengen: blank('Schengen'), Other: blank('Other') };
  const week = dayBefore(todayStr, 6);
  for (const l of leads) {
    const s = out[groupOf(l)];
    s.total++;
    if (isFresh(l, nowMs, todayStr)) s.fresh++;
    if (l.stage === 'New') s.waiting++;
    if (l.stage !== 'New') s.contacted++;
    if (l.stage === 'Qualified' || l.stage === 'Converted') s.qualified++;
    if (l.stage === 'Converted') s.converted++;
    if (l.stage === 'Lost') s.lost++;
    if (!isClosed(l)) { s.open++; if (!l.assignedTo) s.unassigned++; }
    const f = followState(l, todayStr);
    if (f === 'overdue') { s.overdue++; s.due++; } else if (f === 'today') s.due++;
    if (l.createdAt >= week) s.last7++;
    const stamp = l.receivedAt || l.createdAt || '';
    // A bare date sorts before any timestamp of the same day, which is what we want.
    if (stamp && stamp > s.latest) s.latest = stamp;
  }
  for (const g of GROUPS) out[g].conversionPct = pct(out[g].converted, out[g].total);
  return out;
}
export function totalStats(by: Record<CountryGroup, GroupStats>): GroupStats {
  const t: GroupStats = { group: 'Other', total: 0, fresh: 0, waiting: 0, contacted: 0, qualified: 0, converted: 0, lost: 0, due: 0, overdue: 0, unassigned: 0, open: 0, conversionPct: 0, latest: '', last7: 0 };
  for (const g of GROUPS) {
    const s = by[g];
    t.total += s.total; t.fresh += s.fresh; t.waiting += s.waiting; t.contacted += s.contacted; t.qualified += s.qualified;
    t.converted += s.converted; t.lost += s.lost; t.due += s.due; t.overdue += s.overdue; t.unassigned += s.unassigned; t.open += s.open; t.last7 += s.last7;
    if (s.latest > t.latest) t.latest = s.latest;
  }
  t.conversionPct = pct(t.converted, t.total);
  return t;
}

// New leads per day for the last `days` days (oldest → newest), split by country tab.
export function arrivalsByDay(leads: Lead[], days: number, todayStr: string): { date: string; label: string; UK: number; Schengen: number; Other: number }[] {
  const rows = Array.from({ length: days }, (_, k) => {
    const date = dayBefore(todayStr, days - 1 - k);
    const d = new Date(date + 'T12:00:00Z');
    return { date, label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }), UK: 0, Schengen: 0, Other: 0 };
  });
  const at = new Map(rows.map(r => [r.date, r]));
  for (const l of leads) {
    const r = at.get(l.createdAt);
    if (r) r[groupOf(l)]++;
  }
  return rows;
}

// Which tab a lead list belongs to.
export type LeadTab = 'dashboard' | 'UK' | 'Schengen' | 'Other' | 'all';
export function inTab(l: Lead, tab: LeadTab): boolean {
  if (tab === 'all' || tab === 'dashboard') return true;
  return groupOf(l) === tab;
}

// The tab a lead source (one ad form) belongs to: the country it is set to, or — when it
// takes the country from the sheet — the country most of its leads ended up in.
export function sourceGroup(src: { id: string; country: string }, leads: Lead[]): CountryGroup {
  if (src.country) return groupOf({ destination: src.country });
  const mine = leads.filter(l => l.sourceId === src.id);
  if (!mine.length) return 'Other';
  const n = (g: CountryGroup) => mine.filter(l => groupOf(l) === g).length;
  return [...GROUPS].sort((a, b) => n(b) - n(a) || groupRank(a) - groupRank(b))[0];
}
// The most common country label among a source's leads ('' when it has none).
export function dominantCountry(src: { id: string }, leads: Lead[]): string {
  const m = new Map<string, number>();
  for (const l of leads) if (l.sourceId === src.id && l.destination) m.set(l.destination, (m.get(l.destination) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}
