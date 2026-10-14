import { readJsonFile, writeJsonFile } from './store';
import { addDaysISO, pktNow } from './reportSchedule';
import type { MetaWindow, MetaAccount, MetaCampaign, MetaSnapshot, MetaData } from './metaTypes';
import { WINDOWS } from './metaTypes';
export { WINDOWS };
export type { MetaWindow, MetaAccount, MetaCampaign, MetaSnapshot, MetaData };

// Reads your Meta (Facebook / Instagram) Ads Manager account, read-only: which
// campaigns exist, whether they are running, what they spent, and how many
// leads Meta says they produced. The portal then sets that against the leads,
// clients and payments it holds itself. The access token stays on the server —
// the browser only ever sees the last four characters.

export interface MetaAdsConfig {
  accountId: string;        // digits only, without "act_"
  token: string;
  usdRate: number;          // rupees per $1, for the rupee estimate (0 = use the last rate logged in Campaigns)
  taxPct: number;           // tax / bank charges on top of dollar payments
  auto: boolean;            // refresh by itself
  everyMinutes: number;
  lastError: string;
  lastOkAt: string;
  lastRefreshAt: string;    // ISO time of the last automatic round
}
const CONFIG_FILE = 'metaads';
const DATA_FILE = 'metaadsdata';
export const DEFAULT_META: MetaAdsConfig = { accountId: '', token: '', usdRate: 0, taxPct: 0, auto: true, everyMinutes: 60, lastError: '', lastOkAt: '', lastRefreshAt: '' };

export function readMetaConfig(): MetaAdsConfig {
  const c = { ...DEFAULT_META, ...readJsonFile<Partial<MetaAdsConfig>>(CONFIG_FILE, {}) };
  if (process.env.META_ADS_TOKEN) c.token = process.env.META_ADS_TOKEN;
  if (process.env.META_AD_ACCOUNT_ID) c.accountId = parseAccountId(process.env.META_AD_ACCOUNT_ID);
  return c;
}
export function writeMetaConfig(c: MetaAdsConfig) {
  const toSave = { ...c };
  if (process.env.META_ADS_TOKEN && toSave.token === process.env.META_ADS_TOKEN) toSave.token = '';
  if (process.env.META_AD_ACCOUNT_ID && toSave.accountId === parseAccountId(process.env.META_AD_ACCOUNT_ID)) toSave.accountId = '';
  writeJsonFile(CONFIG_FILE, toSave);
}
export const readMetaData = (): MetaData => ({ snapshots: {}, ...readJsonFile<Partial<MetaData>>(DATA_FILE, {}) });
const writeMetaData = (d: MetaData) => writeJsonFile(DATA_FILE, d);
export const clearMetaData = () => writeMetaData({ snapshots: {} });

export const isConnected = (c: MetaAdsConfig) => !!c.accountId && !!c.token;

export function publicMetaConfig(c: MetaAdsConfig) {
  return {
    connected: isConnected(c), accountId: c.accountId, tokenSet: !!c.token, tokenHint: c.token ? '…' + c.token.slice(-4) : '',
    tokenFromHosting: !!process.env.META_ADS_TOKEN, accountFromHosting: !!process.env.META_AD_ACCOUNT_ID,
    usdRate: c.usdRate, taxPct: c.taxPct, auto: c.auto, everyMinutes: c.everyMinutes,
    lastError: c.lastError, lastOkAt: c.lastOkAt, lastRefreshAt: c.lastRefreshAt,
  };
}

// Accepts "act_1234567890", "1234-567-890", or a whole Ads Manager address that contains act=1234567890.
export function parseAccountId(input: string): string {
  const s = String(input || '').trim();
  const fromUrl = s.match(/[?&]act=(\d{5,})/);
  if (fromUrl) return fromUrl[1];
  const digits = s.replace(/^act_/i, '').replace(/[\s-]/g, '');
  return /^\d{5,20}$/.test(digits) ? digits : '';
}
export const looksLikeToken = (t: string) => /^[A-Za-z0-9_\-|.]{20,}$/.test(String(t || '').trim());

// ---------------------------------------------------------------- Graph API
const base = () => process.env.META_GRAPH_BASE || 'https://graph.facebook.com/v25.0';

export class MetaError extends Error {
  constructor(message: string, public kind: 'token' | 'permission' | 'account' | 'rate' | 'network' | 'other', public code?: number) { super(message); }
}

type GraphErr = { error?: { message?: string; code?: number; error_subcode?: number; type?: string } };
function explain(status: number, body: GraphErr): MetaError {
  const e = body.error || {};
  const code = e.code, sub = e.error_subcode, msg = String(e.message || '');
  if (code === 190 || sub === 463 || sub === 467) return new MetaError('Meta says the access token is no longer valid (expired, or the person who made it changed their password). Make a new token and paste it again.', 'token', code);
  if (code === 4 || code === 17 || code === 32 || code === 613 || (code && code >= 80000 && code <= 80014)) return new MetaError('Meta is limiting how often this account can be read right now. Wait a few minutes and try again.', 'rate', code);
  if (code === 100 && /does not exist|cannot be loaded|missing permissions|unsupported get request/i.test(msg)) return new MetaError('Meta cannot find that ad account, or this token has no access to it. Check the ad account ID, and that the account is added to the token’s user with “View performance”.', 'account', code);
  if (code === 200 || code === 10 || code === 294 || /permission/i.test(msg)) return new MetaError('The token is valid but is not allowed to read ads. Make it again with the ads_read permission, and add this ad account to its user.', 'permission', code);
  if (status >= 500) return new MetaError('Meta had a problem on its side. Try again in a little while.', 'other', code);
  return new MetaError(`Meta refused the request${code ? ` (error ${code})` : ''}${msg ? `: ${msg.slice(0, 160)}` : ''}.`, 'other', code);
}

async function graph(cfg: Pick<MetaAdsConfig, 'token'>, path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const u = new URL(`${base()}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', cfg.token);
  let res: Response;
  try { res = await fetch(u, { signal: AbortSignal.timeout(30000), cache: 'no-store' }); }
  catch { throw new MetaError('Could not reach Meta. Check the internet connection of the server and try again.', 'network'); }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok || json.error) throw explain(res.status, json as GraphErr);
  return json;
}

// Reads every page of a list, using Meta's paging cursor (never the "next" link, which carries the token).
async function graphAll(cfg: Pick<MetaAdsConfig, 'token'>, path: string, params: Record<string, string>, maxPages = 20): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let after = '';
  for (let i = 0; i < maxPages; i++) {
    const j = await graph(cfg, path, { ...params, limit: '100', ...(after ? { after } : {}) });
    out.push(...((j.data as Record<string, unknown>[]) || []));
    const paging = j.paging as { cursors?: { after?: string }; next?: string } | undefined;
    after = paging?.next ? paging.cursors?.after || '' : '';
    if (!after) break;
  }
  return out;
}

const ACCOUNT_STATUS: Record<number, string> = {
  1: 'Active', 2: 'Disabled', 3: 'Payment problem', 7: 'Under review', 8: 'Settling a payment', 9: 'Grace period', 100: 'Closing', 101: 'Closed', 201: 'Active', 202: 'Closed',
};
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export async function readAccount(cfg: MetaAdsConfig): Promise<MetaAccount> {
  const j = await graph(cfg, `/act_${cfg.accountId}`, { fields: 'name,currency,account_status,timezone_name,amount_spent,balance' });
  const status = num(j.account_status);
  // amount_spent and balance come in the currency's smallest unit (cents). PKR / USD both use 100.
  return {
    id: cfg.accountId, name: String(j.name || ''), currency: String(j.currency || ''), status, statusText: ACCOUNT_STATUS[status] || `Status ${status}`,
    timezone: String(j.timezone_name || ''), amountSpent: num(j.amount_spent) / 100, balance: num(j.balance) / 100,
  };
}

// "Leads" as Meta counts them for a campaign. `lead` already adds up every kind of lead result;
// the other names are only used when it is missing, so nothing is counted twice.
export function leadsFromActions(actions: unknown): number {
  const list = Array.isArray(actions) ? actions as { action_type?: string; value?: string }[] : [];
  const get = (t: string) => list.find(a => a.action_type === t);
  const pick = get('lead') || get('onsite_conversion.lead_grouped') || get('offsite_conversion.fb_pixel_lead');
  return pick ? Math.round(num(pick.value)) : 0;
}

export function windowRange(w: MetaWindow, nowMs = Date.now()): { since: string; until: string } {
  const today = pktNow(nowMs).date;
  switch (w) {
    case 'today': return { since: today, until: today };
    case 'last_7d': return { since: addDaysISO(today, -6), until: today };
    case 'last_30d': return { since: addDaysISO(today, -29), until: today };
    case 'this_month': return { since: today.slice(0, 7) + '-01', until: today };
    default: return { since: '', until: '' };
  }
}

export async function fetchSnapshot(cfg: MetaAdsConfig, w: MetaWindow): Promise<{ account: MetaAccount; snapshot: MetaSnapshot }> {
  const account = await readAccount(cfg);
  const range = windowRange(w);
  const list = await graphAll(cfg, `/act_${cfg.accountId}/campaigns`, {
    fields: 'id,name,effective_status,objective,start_time,stop_time',
    effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ARCHIVED', 'IN_PROCESS', 'WITH_ISSUES']),
  });
  const rows = await graphAll(cfg, `/act_${cfg.accountId}/insights`, {
    level: 'campaign', fields: 'campaign_id,campaign_name,spend,impressions,reach,clicks,actions',
    ...(w === 'maximum' ? { date_preset: 'maximum' } : { time_range: JSON.stringify({ since: range.since, until: range.until }) }),
  });
  const byId = new Map<string, MetaCampaign>();
  for (const c of list) {
    const id = String(c.id);
    byId.set(id, { id, name: String(c.name || ''), status: String(c.effective_status || ''), objective: String(c.objective || ''), startTime: String(c.start_time || '').slice(0, 10), stopTime: String(c.stop_time || '').slice(0, 10), spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, inList: true });
  }
  for (const r of rows) {
    const id = String(r.campaign_id);
    const cur = byId.get(id) || { id, name: String(r.campaign_name || ''), status: 'NOT LISTED', objective: '', startTime: '', stopTime: '', spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, inList: false };
    cur.spend += num(r.spend); cur.impressions += num(r.impressions); cur.reach += num(r.reach); cur.clicks += num(r.clicks); cur.leads += leadsFromActions(r.actions);
    byId.set(id, cur);
  }
  const campaigns = [...byId.values()].sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));
  return { account, snapshot: { window: w, since: range.since, until: range.until, fetchedAt: new Date().toISOString(), currency: account.currency, campaigns } };
}

// Reads from Meta and keeps the answer, so the screen opens instantly next time.
export async function refresh(w: MetaWindow): Promise<{ ok: true; snapshot: MetaSnapshot; account: MetaAccount } | { ok: false; error: string; kind: string }> {
  const cfg = readMetaConfig();
  if (!isConnected(cfg)) return { ok: false, error: 'Ads Manager is not connected yet.', kind: 'other' };
  try {
    const { account, snapshot } = await fetchSnapshot(cfg, w);
    const data = readMetaData();
    data.account = account; data.snapshots[w] = snapshot;
    writeMetaData(data);
    const c = readMetaConfig(); c.lastError = ''; c.lastOkAt = new Date().toISOString(); writeMetaConfig(c);
    return { ok: true, snapshot, account };
  } catch (e) {
    const err = e instanceof MetaError ? e : new MetaError('Something went wrong reading Meta.', 'other');
    const c = readMetaConfig(); c.lastError = err.message; writeMetaConfig(c);
    return { ok: false, error: err.message, kind: err.kind };
  }
}

// Checks a token + account without keeping anything but the account's name.
export async function testConnection(cfg: MetaAdsConfig): Promise<{ ok: true; account: MetaAccount } | { ok: false; error: string; kind: string }> {
  try {
    const account = await readAccount(cfg);
    const data = readMetaData(); data.account = account; writeMetaData(data);
    return { ok: true, account };
  } catch (e) {
    const err = e instanceof MetaError ? e : new MetaError('Something went wrong reading Meta.', 'other');
    return { ok: false, error: err.message, kind: err.kind };
  }
}

// The timer: refresh the windows someone has looked at, when due.
let running = false;
export async function runMetaIfDue(nowMs = Date.now()): Promise<boolean> {
  if (running) return false;
  const cfg = readMetaConfig();
  if (!isConnected(cfg) || !cfg.auto) return false;
  const last = cfg.lastRefreshAt ? Date.parse(cfg.lastRefreshAt) : 0;
  if (nowMs - last < cfg.everyMinutes * 60000) return false;
  running = true;
  try {
    cfg.lastRefreshAt = new Date(nowMs).toISOString(); writeMetaConfig(cfg);
    const seen = Object.keys(readMetaData().snapshots) as MetaWindow[];
    const todo: MetaWindow[] = seen.length ? seen.slice(0, 3) : ['last_30d'];
    for (const w of todo) { const r = await refresh(w); if (!r.ok && (r.kind === 'token' || r.kind === 'account' || r.kind === 'permission')) break; }
    return true;
  } finally { running = false; }
}
