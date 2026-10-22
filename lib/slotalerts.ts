import type { SlotAlert, AlertCategory, AlertVerification, SlotConfig, SlotNotice } from './types';
import { pktToMs } from './slotdesk';
import { adapterFor, providerName, type ProviderAdapter } from './slotproviders';

// ---------------------------------------------------------------------------------------------
// The early-warning engine. Plain functions, no network.
//
// Every alert says where it came from and how sure we are. The rules that matter:
//  * "Officially announced" needs an official notice and a link to it.
//  * A "confirmed future release" needs a date and time that is still ahead — a guess from past
//    results is never allowed to wear that label.
//  * An observation ("dates are showing") is only ever a staff or client report, never a promise.
//  * The same thing reported twice inside a short window is filed once.
// ---------------------------------------------------------------------------------------------

export const ALERT_CATEGORIES: AlertCategory[] = [
  'OFFICIAL RELEASE ANNOUNCED', 'OFFICIALLY CONFIRMED FUTURE RELEASE', 'APPOINTMENT AVAILABILITY OBSERVED',
  'CANCELLATION AVAILABILITY OBSERVED', 'MANUAL VERIFICATION REQUIRED', 'PROVIDER SOURCE UNAVAILABLE',
];

export interface CategoryInfo {
  key: AlertCategory;
  short: string;
  tone: 'good' | 'info' | 'warn' | 'bad';
  kind: 'announcement' | 'observation' | 'caution' | 'error';
  verifications: AlertVerification[];
  needsOpens: boolean;
  dedupeMin: number;
  meaning: string;
}

export const CATEGORY_INFO: Record<AlertCategory, CategoryInfo> = {
  'OFFICIAL RELEASE ANNOUNCED': {
    key: 'OFFICIAL RELEASE ANNOUNCED', short: 'Release announced', tone: 'info', kind: 'announcement', verifications: ['Official notice'], needsOpens: false, dedupeMin: 24 * 60,
    meaning: 'The embassy or provider published a notice that new dates are coming or have been added. Needs the link to that notice.',
  },
  'OFFICIALLY CONFIRMED FUTURE RELEASE': {
    key: 'OFFICIALLY CONFIRMED FUTURE RELEASE', short: 'Confirmed future release', tone: 'good', kind: 'announcement', verifications: ['Official notice'], needsOpens: true, dedupeMin: 24 * 60,
    meaning: 'The official notice gives the exact date and time new dates open, and that moment is still ahead. A guess never goes here.',
  },
  'APPOINTMENT AVAILABILITY OBSERVED': {
    key: 'APPOINTMENT AVAILABILITY OBSERVED', short: 'Dates seen', tone: 'warn', kind: 'observation', verifications: ['Seen by staff', 'Reported by client', 'Unverified'], needsOpens: false, dedupeMin: 20,
    meaning: 'Someone saw appointment dates on the official booking site. It is an observation, not an announcement — dates can vanish in minutes.',
  },
  'CANCELLATION AVAILABILITY OBSERVED': {
    key: 'CANCELLATION AVAILABILITY OBSERVED', short: 'Cancelled slot seen', tone: 'warn', kind: 'observation', verifications: ['Seen by staff', 'Reported by client', 'Unverified'], needsOpens: false, dedupeMin: 20,
    meaning: 'Someone saw a slot appear after a cancellation. Usually one or two slots, gone fast.',
  },
  'MANUAL VERIFICATION REQUIRED': {
    key: 'MANUAL VERIFICATION REQUIRED', short: 'Check by hand', tone: 'warn', kind: 'caution', verifications: ['Unverified', 'Reported by client'], needsOpens: false, dedupeMin: 60,
    meaning: 'A rumour, a screenshot, an agent’s claim — or the official page has not been checked for too long. Treat it as unproven until someone looks.',
  },
  'PROVIDER SOURCE UNAVAILABLE': {
    key: 'PROVIDER SOURCE UNAVAILABLE', short: 'Source not opening', tone: 'bad', kind: 'error', verifications: ['Seen by staff'], needsOpens: false, dedupeMin: 60,
    meaning: 'The official page or booking site would not open, so we cannot say whether dates are open. Goes into the error log.',
  },
};

export const SOURCE_CHOICES = [
  'Official notice page', 'Embassy announcement', 'Provider booking site (checked by our staff)', 'Client told us', 'WhatsApp / agent message', 'Other',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-16T10:05:00Z" → "16 Oct, 3:05 pm" in Pakistan time. */
export function fmtPkt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const d = new Date(t + 5 * 3600 * 1000);
  const h = d.getUTCHours();
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${((h + 11) % 12) + 1}:${pad(d.getUTCMinutes())} ${h < 12 ? 'am' : 'pm'}`;
}
/** "2026-10-20" + "15:00" → "20 Oct, 3:00 pm". */
export function fmtOpens(dateIso: string, hhmm: string): string {
  const ms = pktToMs(dateIso, hhmm);
  return Number.isFinite(ms) ? fmtPkt(new Date(ms).toISOString()) : '—';
}
export function agoLabel(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const m = Math.max(0, Math.round((nowMs - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

const isUrl = (s: string) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(s.trim());
const normCentre = (s: string) => (s || '').trim().toLowerCase();

export const opensAtMs = (a: Pick<SlotAlert, 'opensDate' | 'opensTime'>): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.opensDate || '') || !/^\d{1,2}:\d{2}$/.test(a.opensTime || '')) return null;
  const ms = pktToMs(a.opensDate, a.opensTime);
  return Number.isFinite(ms) ? ms : null;
};

/** '' when the alert is acceptable, otherwise the reason in plain words. */
export function validateAlert(a: Partial<SlotAlert>, nowMs: number): string {
  const info = a.category ? CATEGORY_INFO[a.category] : undefined;
  if (!info) return 'Choose what kind of alert this is';
  if (!a.country) return 'Choose the country';
  if (!(a.source || '').trim()) return 'Say where this came from';
  if (!a.verification || !info.verifications.includes(a.verification)) return `For “${info.short}” the check level must be: ${info.verifications.join(' or ')}`;
  if (a.verification === 'Official notice' && !isUrl(a.sourceUrl || '')) return 'An official notice needs the link to the official page';
  if ((a.sourceUrl || '').trim() && !isUrl(a.sourceUrl || '')) return 'The link must start with https://';
  if (info.needsOpens) {
    const ms = opensAtMs({ opensDate: a.opensDate || '', opensTime: a.opensTime || '' });
    if (ms === null) return 'A confirmed future release needs the date and the time it opens';
    if (ms <= nowMs) return 'That date and time has already passed — log it as “Release announced” or “Dates seen” instead';
  }
  if (info.kind === 'observation' || info.kind === 'error') {
    const t = Date.parse(a.at || '');
    if (!Number.isFinite(t)) return 'Enter the time it was seen';
    if (t > nowMs + 5 * 60000) return 'The time seen cannot be in the future';
  }
  return '';
}

/** What the alert may truthfully claim. Never more than its source supports. */
export function claimOf(a: SlotAlert): string {
  const who = a.loggedBy || 'A team member';
  switch (a.category) {
    case 'OFFICIALLY CONFIRMED FUTURE RELEASE':
      return `Officially announced: new dates open ${fmtOpens(a.opensDate, a.opensTime)} (Pakistan time). Source: ${a.source}.`;
    case 'OFFICIAL RELEASE ANNOUNCED':
      return a.opensDate && opensAtMs(a)
        ? `The official source announced a release for ${fmtOpens(a.opensDate, a.opensTime || '00:00')}. Check the notice for the exact time before telling clients.`
        : 'The official source announced a release. Read the notice for the exact date and time before telling clients.';
    case 'APPOINTMENT AVAILABILITY OBSERVED':
      return a.verification === 'Seen by staff'
        ? `${who} saw appointment dates on the booking site at ${fmtPkt(a.at)}. This is a staff observation, not a provider announcement — the dates may already be gone.`
        : a.verification === 'Reported by client'
          ? 'A client says dates are showing. Our team has not checked this yet.'
          : 'Unverified report. Do not tell clients until someone has checked the official site.';
    case 'CANCELLATION AVAILABILITY OBSERVED':
      return a.verification === 'Seen by staff'
        ? `${who} saw a slot appear after a cancellation at ${fmtPkt(a.at)}. It is a staff observation — it may be taken already.`
        : a.verification === 'Reported by client'
          ? 'A client says a cancelled slot is showing. Our team has not checked this yet.'
          : 'Unverified report of a cancelled slot. Check the official site before telling anyone.';
    case 'MANUAL VERIFICATION REQUIRED':
      return 'We cannot confirm this yet. Treat it as unproven until someone checks the official page.';
    case 'PROVIDER SOURCE UNAVAILABLE':
      return 'The official page could not be opened, so we cannot say whether dates are open.';
  }
}

export function nextAction(a: SlotAlert): string {
  const verified = a.verification === 'Seen by staff';
  switch (a.category) {
    case 'OFFICIALLY CONFIRMED FUTURE RELEASE': return 'Put the team on the rota for that time, tell waiting clients to be ready (no date promised), and keep the official page open.';
    case 'OFFICIAL RELEASE ANNOUNCED': return 'Read the notice, note the exact date and time, then log it as a confirmed future release.';
    case 'APPOINTMENT AVAILABILITY OBSERVED': return verified
      ? 'Open the official booking page now, alert the team and start the Live booking board. The client books in their own name.'
      : 'Check the official booking page yourself first. Alert the team only when you can see dates.';
    case 'CANCELLATION AVAILABILITY OBSERVED': return verified
      ? 'A single slot can go in minutes — call the first ready client now and stay with them while they book.'
      : 'Check the official booking page yourself first. If a slot is there, call the first ready client at once.';
    case 'MANUAL VERIFICATION REQUIRED': return 'Open the official page and check by hand. Do not message clients about this.';
    case 'PROVIDER SOURCE UNAVAILABLE': return 'Try again in 15 minutes from another phone or network, then ask the provider’s helpline. Log it when the page is back.';
  }
}

/** The same thing reported twice, close together, is filed once. */
export function isDuplicateAlert(existing: SlotAlert[], c: Pick<SlotAlert, 'category' | 'country' | 'centre' | 'at' | 'opensDate' | 'opensTime'>): SlotAlert | null {
  const info = CATEGORY_INFO[c.category];
  const ct = Date.parse(c.at);
  return existing.find(e => {
    if (e.category !== c.category || e.country !== c.country || normCentre(e.centre) !== normCentre(c.centre)) return false;
    if (info.kind === 'announcement' && c.opensDate) return e.opensDate === c.opensDate && e.opensTime === c.opensTime;
    const et = Date.parse(e.at);
    return Number.isFinite(et) && Number.isFinite(ct) && Math.abs(et - ct) < info.dedupeMin * 60000;
  }) || null;
}

export interface Signal {
  category: AlertCategory;
  country: string; centre: string;
  source: string; sourceUrl: string;
  verification: AlertVerification;
  opensDate?: string; opensTime?: string;
  note?: string; by: string; atIso: string;
  /** 'person' = typed in by a team member; 'feed' = delivered by an approved provider feed (none exists yet) */
  via: 'person' | 'feed';
}

export type IngestResult = { alert: SlotAlert; error?: undefined; duplicate?: undefined } | { alert?: undefined; error: string; duplicate?: undefined } | { alert?: undefined; error?: undefined; duplicate: SlotAlert };

/**
 * The one door every report goes through, whichever adapter produced it: check it, refuse it if it
 * claims more than its source supports, file it once. A manual adapter hands over what a person typed;
 * an approved feed (if one is ever agreed with a provider) would hand over the same shape.
 */
export function ingest(adapter: ProviderAdapter, s: Signal, existing: SlotAlert[], nowMs: number, id: string): IngestResult {
  if (s.via === 'feed' && !(adapter.mode === 'official-feed' && adapter.feedEnabled)) return { error: 'No approved feed is switched on for this country, so nothing can arrive automatically' };
  const alert: SlotAlert = {
    id, category: s.category, country: s.country, centre: (s.centre || '').trim(), provider: providerName(s.country),
    at: s.atIso, source: s.source.trim(), sourceUrl: (s.sourceUrl || '').trim(), verification: s.verification,
    opensDate: CATEGORY_INFO[s.category].needsOpens || s.opensDate ? (s.opensDate || '') : '', opensTime: CATEGORY_INFO[s.category].needsOpens || s.opensDate ? (s.opensTime || '') : '',
    note: (s.note || '').trim(), loggedBy: s.by, handled: false,
  };
  const err = validateAlert(alert, nowMs);
  if (err) return { error: err };
  const dup = isDuplicateAlert(existing, alert);
  if (dup) return { duplicate: dup };
  return { alert };
}
export { adapterFor };

export const sortAlerts = (list: SlotAlert[]): SlotAlert[] => [...list].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || b.id.localeCompare(a.id));

/** Confirmed future releases that have not happened yet, soonest first. */
export function upcomingOfficial(alerts: SlotAlert[], nowMs: number, withinDays = 30): SlotAlert[] {
  return alerts
    .filter(a => a.category === 'OFFICIALLY CONFIRMED FUTURE RELEASE' && a.verification === 'Official notice')
    .map(a => ({ a, ms: opensAtMs(a) }))
    .filter((x): x is { a: SlotAlert; ms: number } => x.ms !== null && x.ms > nowMs && x.ms - nowMs <= withinDays * 86400000)
    .sort((x, y) => x.ms - y.ms).map(x => x.a);
}

// ---------------------------------------------------------------------------------------------
// Settings and source health
// ---------------------------------------------------------------------------------------------
export const DEFAULT_CHECK_HOURS = 24;
export function configFor(configs: SlotConfig[], country: string): SlotConfig {
  return configs.find(c => c.country === country) || { id: country, country, officialUrl: '', checkEveryHours: DEFAULT_CHECK_HOURS, notify: [], enabled: true, lastCheckedAt: '', lastCheckedBy: '' };
}

export interface SourceHealth {
  country: string;
  state: 'Fresh' | 'Due' | 'Overdue' | 'Never checked' | 'Paused';
  hoursSince: number | null;
  alerts7d: number; errors7d: number; observations7d: number;
  last: SlotAlert | null;
}
export function sourceHealth(country: string, cfg: SlotConfig, alerts: SlotAlert[], nowMs: number): SourceHealth {
  const mine = sortAlerts(alerts.filter(a => a.country === country));
  const week = mine.filter(a => nowMs - (Date.parse(a.at) || 0) <= 7 * 86400000);
  const base = { country, alerts7d: week.length, errors7d: week.filter(a => a.category === 'PROVIDER SOURCE UNAVAILABLE').length, observations7d: week.filter(a => CATEGORY_INFO[a.category].kind === 'observation').length, last: mine[0] || null };
  if (!cfg.enabled) return { ...base, state: 'Paused', hoursSince: null };
  const t = Date.parse(cfg.lastCheckedAt || '');
  if (!Number.isFinite(t)) return { ...base, state: 'Never checked', hoursSince: null };
  const hours = Math.max(0, (nowMs - t) / 3600000);
  const every = Math.max(1, cfg.checkEveryHours || DEFAULT_CHECK_HOURS);
  return { ...base, hoursSince: Math.round(hours * 10) / 10, state: hours < every ? 'Fresh' : hours < every * 2 ? 'Due' : 'Overdue' };
}

/** Reminders made on the fly (not stored): the official page has not been checked for too long. */
export function systemAlerts(countries: readonly string[], configs: SlotConfig[], alerts: SlotAlert[], nowMs: number): SlotAlert[] {
  const out: SlotAlert[] = [];
  for (const country of countries) {
    const h = sourceHealth(country, configFor(configs, country), alerts, nowMs);
    if (h.state !== 'Overdue' && h.state !== 'Never checked') continue;
    out.push({
      id: `sys-${country}`, category: 'MANUAL VERIFICATION REQUIRED', country, centre: '', provider: providerName(country),
      at: new Date(nowMs).toISOString(), source: 'Portal reminder', sourceUrl: '', verification: 'Unverified', opensDate: '', opensTime: '',
      note: h.state === 'Never checked' ? 'The official notices page has never been marked as checked in this portal.' : `The official notices page was last checked ${Math.round(h.hoursSince || 0)} hours ago.`,
      loggedBy: 'Portal', handled: false,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Notification log: one record per attempt to tell a team member. The portal never sends anything
// itself — it opens WhatsApp (or copies the text) for a person to send — so "Opened" is all it can
// know until staff say whether it went.
// ---------------------------------------------------------------------------------------------
export const MAX_ATTEMPTS = 3;
export type SendState = { state: 'new' | 'opened' | 'sent' | 'failed' | 'limit'; attempts: number; last: SlotNotice | null };

export function sendState(notices: SlotNotice[], to: string, topic: string): SendState {
  const mine = notices.filter(n => n.to === to && n.topic === topic).sort((a, b) => a.attempt - b.attempt);
  const last = mine[mine.length - 1] || null;
  if (!last) return { state: 'new', attempts: 0, last: null };
  if (mine.some(n => n.status === 'Sent')) return { state: 'sent', attempts: mine.length, last: mine.filter(n => n.status === 'Sent').pop() || last };
  // A try that was opened but not yet confirmed must stay open, so staff can still say "sent" or "did not go".
  // The limit only applies once every try is used up AND the last one is known to have failed.
  if (last.status !== 'Failed') return { state: 'opened', attempts: mine.length, last };
  if (mine.length >= MAX_ATTEMPTS) return { state: 'limit', attempts: mine.length, last };
  return { state: 'failed', attempts: mine.length, last };
}

/** A topic for a message that is not tied to a stored alert: the place and the two-hour stretch of the day. */
export function topicFor(alertId: string, country: string, centre: string, nowMs: number): string {
  if (alertId) return alertId;
  const d = new Date(nowMs + 5 * 3600 * 1000);
  return `${country}|${normCentre(centre)}|${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}|${Math.floor(d.getUTCHours() / 2)}`;
}

/** Message for a stored alert, written so it can never claim more than the alert does. */
export function alertTeamMessage(a: SlotAlert): string {
  const where = `${a.country}${a.centre ? ' ' + a.centre : ''}`;
  const head = a.category === 'OFFICIALLY CONFIRMED FUTURE RELEASE' ? `Official: ${where} opens new dates ${fmtOpens(a.opensDate, a.opensTime)} (Pakistan time).`
    : a.category === 'OFFICIAL RELEASE ANNOUNCED' ? `Official notice for ${where}: a release was announced.`
    : a.category === 'APPOINTMENT AVAILABILITY OBSERVED' ? `${where}: ${a.verification === 'Seen by staff' ? 'dates were seen on the booking site' : 'someone reports dates showing (not checked yet)'}.`
    : a.category === 'CANCELLATION AVAILABILITY OBSERVED' ? `${where}: ${a.verification === 'Seen by staff' ? 'a cancelled slot was seen' : 'someone reports a cancelled slot (not checked yet)'}.`
    : a.category === 'MANUAL VERIFICATION REQUIRED' ? `${where}: unproven report — please check the official page by hand.`
    : `${where}: the official page is not opening.`;
  return `${head} Source: ${a.source}${a.sourceUrl ? ' ' + a.sourceUrl : ''}. ${nextAction(a)}`;
}
