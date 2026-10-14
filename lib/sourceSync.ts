import { readCollection, updateCollectionSync, readJsonFile, writeJsonFile, readRaw } from './store';
import { parseCsv } from './csv';
import { buildLeadsFromRows, sheetCsvUrl } from './leadImport';
import { today } from './constants';
import { ensureCampaignsFor } from './campaignAuto';
import type { Lead, LeadSource } from './types';

// Pulls the leads of each lead source (one Google Sheet per ad form) into the
// portal. Used by the "Sync now" buttons and by the automatic timer, so a
// lead lands the same way whichever door it came through.

export interface SyncOutcome {
  sourceId: string; label: string; rows: number; imported: number; duplicates: number;
  incomplete: number; tooOld: number; tagged: number; error?: string; legacy?: boolean;
}
export interface SourceStatus {
  at: string; ok: boolean; rows: number; imported: number; duplicates: number; incomplete: number; tooOld: number; tagged: number;
  error?: string; lastOkAt?: string; totalImported: number;
}
export interface SyncState {
  auto: boolean;            // pull every active source on a timer
  everyMinutes: number;
  lastRunAt: string;        // ISO time of the last automatic run
  status: Record<string, SourceStatus>;
}

const FILE = 'leadsync';
export const DEFAULT_SYNC: SyncState = { auto: true, everyMinutes: 15, lastRunAt: '', status: {} };
export const readSyncState = (): SyncState => ({ ...DEFAULT_SYNC, ...readJsonFile<Partial<SyncState>>(FILE, {}) });
const writeSyncState = (s: SyncState) => writeJsonFile(FILE, s);

export function setSyncConfig(p: { auto?: boolean; everyMinutes?: number }) {
  const s = readSyncState();
  if (typeof p.auto === 'boolean') s.auto = p.auto;
  if (typeof p.everyMinutes === 'number') s.everyMinutes = Math.min(1440, Math.max(5, Math.round(p.everyMinutes)));
  writeSyncState(s);
  return s;
}

function record(o: SyncOutcome) {
  if (o.legacy) return;
  const s = readSyncState();
  const prev = s.status[o.sourceId];
  s.status[o.sourceId] = {
    at: new Date().toISOString(), ok: !o.error, rows: o.rows, imported: o.imported, duplicates: o.duplicates,
    incomplete: o.incomplete, tooOld: o.tooOld, tagged: o.tagged, ...(o.error ? { error: o.error } : {}),
    lastOkAt: o.error ? prev?.lastOkAt : new Date().toISOString(),
    totalImported: (prev?.totalImported || 0) + o.imported,
  };
  writeSyncState(s);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const sheetsBase = () => process.env.SHEETS_TEST_BASE || 'https://docs.google.com';

export async function fetchSheet(link: string): Promise<{ headers: string[]; rows: string[][]; formName: string } | { error: string }> {
  const conv = sheetCsvUrl(link, sheetsBase());
  if (!conv.url) return { error: conv.error || 'Not a usable link' };
  let csvText = '';
  try {
    const res = await fetch(conv.url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      return { error: res.status === 404 || res.status === 400
        ? "Google couldn't find that sheet or tab — check the link is complete."
        : `Couldn't reach that sheet (HTTP ${res.status}).` };
    }
    csvText = await res.text();
  } catch {
    return { error: "Couldn't reach that sheet — check the link is correct." };
  }
  // A private sheet answers with a Google sign-in web page, not data.
  if (/^\s*<(!doctype|html)/i.test(csvText)) {
    return { error: 'Google is asking for a sign-in — open the sheet, press Share, and under General access choose "Anyone with the link" (Viewer). Then sync again.' };
  }
  const { headers, rows } = parseCsv(csvText);
  if (!headers.length) return { error: "That link didn't return any readable data." };
  const formCol = headers.findIndex(h => h.trim().toLowerCase() === 'form_name');
  const formName = formCol > -1 ? (rows.find(r => (r[formCol] || '').trim())?.[formCol] || '').trim() : '';
  return { headers, rows, formName };
}

// Brings one sheet's leads in. `src` is null for an old-style plain link.
async function pull(link: string, label: string, src: LeadSource | null, sinceDays?: number): Promise<SyncOutcome> {
  const out: SyncOutcome = { sourceId: src?.id || '', label, rows: 0, imported: 0, duplicates: 0, incomplete: 0, tooOld: 0, tagged: 0, ...(src ? {} : { legacy: true }) };
  const got = await fetchSheet(link);
  if ('error' in got) { out.error = got.error; record(out); return out; }
  out.rows = got.rows.length;
  if (!src && got.formName) out.label = got.formName;
  const sinceDate = sinceDays && sinceDays > 0 ? daysAgo(sinceDays) : undefined;
  let fresh: Lead[] = [];
  updateCollectionSync('leads', current => {
    const built = buildLeadsFromRows(got.headers, got.rows, {
      existing: current, todayStr: today(), sinceDate,
      defaults: src ? { campaign: src.campaign || undefined, destination: src.country || undefined, sourceId: src.id } : undefined,
    });
    if (built.error) { out.error = built.error; return current; }
    out.imported = built.leads.length; out.duplicates = built.duplicates; out.incomplete = built.incomplete; out.tooOld = built.tooOld;
    out.tagged = built.tagged.length;
    fresh = built.leads;
    let next: Lead[] = current;
    if (built.tagged.length) {
      const patches = new Map(built.tagged.map(t => [t.id, t.patch]));
      next = next.map(l => (patches.has(l.id) ? { ...l, ...patches.get(l.id) } : l));
    }
    if (built.leads.length) next = [...next, ...built.leads];
    return next;
  });
  ensureCampaignsFor(fresh);
  record(out);
  return out;
}

// Only one pull at a time (a button press and the timer can otherwise overlap and
// both report "0 new" for leads the other one just brought in).
let lock: Promise<unknown> = Promise.resolve();
let waiting = 0;
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  waiting++;
  const run = lock.then(fn, fn);
  lock = run.then(() => undefined, () => undefined).then(() => { waiting--; });
  return run;
}

const syncSourceRaw = (src: LeadSource, sinceDays?: number) => pull(src.url, src.name, src, sinceDays ?? src.sinceDays);
export const syncSource = (src: LeadSource, sinceDays?: number) => exclusive(() => syncSourceRaw(src, sinceDays));

// Everything the portal knows about: every active source, then any old-style
// links typed into the "Sync from Google Sheet" window that are not a source yet.
export const syncAll = (opts: { sinceDays?: number; auto?: boolean } = {}) => exclusive(() => syncAllRaw(opts));

async function syncAllRaw(opts: { sinceDays?: number; auto?: boolean } = {}): Promise<SyncOutcome[]> {
  const sources = (readCollection('leadsources') as LeadSource[]).filter(s => s.active !== false && s.url);
  const state = readSyncState();
  const out: SyncOutcome[] = [];
  for (const src of sources) {
    // After its first good sync an automatic run only looks back a week — cheap, and
    // it never brings back an old lead somebody deliberately deleted.
    const days = opts.sinceDays !== undefined ? opts.sinceDays
      : opts.auto && state.status[src.id]?.lastOkAt ? Math.min(src.sinceDays || 7, 7) : src.sinceDays;
    out.push(await syncSourceRaw(src, days));
  }
  if (!opts.auto) {
    const have = new Set(sources.map(s => sheetCsvUrl(s.url, sheetsBase()).url).filter(Boolean));
    const legacy = readRaw('sheetsyncurl', '').split(/\s*\n\s*/).map(s => s.trim()).filter(Boolean);
    for (const link of legacy) {
      const conv = sheetCsvUrl(link, sheetsBase());
      if (conv.url && have.has(conv.url)) continue;
      out.push(await pull(link, link.slice(0, 60), null, opts.sinceDays));
    }
  }
  return out;
}

// One automatic round, if it is due. Reserves the slot first so two timers can't both run.
let running = false;
export async function runAutoIfDue(nowMs = Date.now()): Promise<SyncOutcome[] | null> {
  if (running || waiting > 0) return null;   // a pull is already under way
  const st = readSyncState();
  if (!st.auto) return null;
  if (!(readCollection('leadsources') as LeadSource[]).some(s => s.active !== false && s.url)) return null;
  const last = st.lastRunAt ? Date.parse(st.lastRunAt) : 0;
  if (nowMs - last < st.everyMinutes * 60000) return null;
  running = true;
  try {
    st.lastRunAt = new Date(nowMs).toISOString();
    writeSyncState(st);
    return await syncAll({ auto: true });
  } finally { running = false; }
}
