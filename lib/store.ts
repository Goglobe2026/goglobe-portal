import fs from 'fs';
import path from 'path';
import type { Collections, CollectionName } from './types';

// On Render, the persistent disk is mounted at exactly /data — that's the
// only location that survives a full rebuild. Using anything computed from
// process.cwd() (the app's own code directory) silently writes to a folder
// that looks like it works, but isn't actually the protected disk. This
// checks for the real mount first, and only falls back to a local ./data
// folder when there's no mounted disk at all (e.g. running locally).
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const writeQueues: Record<string, Promise<void>> = {};

function filePath(collection: string) {
  return path.join(DATA_DIR, `${collection}.json`);
}

export function readCollection<K extends CollectionName>(collection: K): Collections[K] {
  const fp = filePath(collection);
  if (!fs.existsSync(fp)) return [] as unknown as Collections[K];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8') || '[]');
  } catch (e) {
    console.error(`Corrupt data file for ${collection}, returning empty:`, (e as Error).message);
    return [] as unknown as Collections[K];
  }
}

export function writeCollection<K extends CollectionName>(collection: K, records: Collections[K]): Promise<void> {
  const prev = writeQueues[collection] || Promise.resolve();
  const next = prev.then(() => {
    const fp = filePath(collection);
    const tmp = `${fp}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
    fs.renameSync(tmp, fp);
  });
  writeQueues[collection] = next.catch(() => {});
  return next;
}

// Read, change and write a collection in one uninterrupted step. Node runs one
// piece of code at a time, so while this function is running nothing else can
// read or write the same file — which is what stops two people (or the sheet
// sync and a staff member) from overwriting each other's changes. Return the
// same array you were given to skip writing.
export function updateCollectionSync<K extends CollectionName>(collection: K, fn: (current: Collections[K]) => Collections[K]): Collections[K] {
  const current = readCollection(collection);
  const next = fn(current);
  if (next === current) return current;
  const fp = filePath(collection);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, fp);
  return next;
}

// ---------------------------------------------------------------------------
// Safe saving for lists of records (cases, leads, transactions, ...).
//
// Browsers send "here is my whole list" every time someone edits one thing.
// If that browser's copy was a few minutes old, a plain overwrite would wipe
// out whatever other people (or the Google Sheet sync) added in the meantime.
// So instead the server MERGES: every record is matched by its id and
//   - records the browser doesn't have yet (added by someone else) are kept,
//   - records the browser deliberately deleted are removed (and remembered, so
//     another stale browser can't bring them back),
//   - when both sides have the same record, the most recently edited one wins
//     (each edit is stamped `_u` in the browser, in server time).
// ---------------------------------------------------------------------------
type Rec = { id: string; _u?: number; [k: string]: unknown };

function tombFile() { return path.join(DATA_DIR, '_tombstones.json'); }
function readTombstones(): Record<string, Record<string, number>> {
  try { return JSON.parse(fs.readFileSync(tombFile(), 'utf8') || '{}'); } catch { return {}; }
}

export function allHaveIds(list: unknown): list is Rec[] {
  return Array.isArray(list) && list.every(x => x && typeof x === 'object' && typeof (x as Rec).id === 'string');
}

export function mergeIntoCollection(
  collection: CollectionName,
  incomingRaw: unknown[],
  deleted: string[],
  prepare?: (incoming: any[], stored: any[]) => any[],
): { merged: unknown[]; kept: number } {
  const stored = readCollection(collection) as unknown as Rec[];
  const incoming = (prepare ? prepare(incomingRaw, stored) : incomingRaw) as Rec[];
  const tombs = readTombstones();
  const mine = tombs[collection] || {};
  const now = Date.now();
  for (const id of deleted) mine[id] = now;
  for (const id of Object.keys(mine)) if (now - mine[id] > 60 * 86400000) delete mine[id]; // forget after 60 days
  tombs[collection] = mine;

  const merged = mergeById(stored, incoming, mine);
  const fp = filePath(collection);
  fs.writeFileSync(`${fp}.tmp`, JSON.stringify(merged, null, 2));
  fs.renameSync(`${fp}.tmp`, fp);
  if (deleted.length || Object.keys(mine).length) {
    fs.writeFileSync(`${tombFile()}.tmp`, JSON.stringify(tombs));
    fs.renameSync(`${tombFile()}.tmp`, tombFile());
  }
  return { merged, kept: merged.length - incoming.length };
}

export function mergeById(stored: Rec[], incoming: Rec[], tombstones: Record<string, number>): Rec[] {
  if (!allHaveIds(stored) || !allHaveIds(incoming)) return incoming;
  const storedById = new Map(stored.map(r => [r.id, r]));
  const out: Rec[] = [];
  const seen = new Set<string>();
  for (const item of incoming) {
    const tomb = tombstones[item.id];
    if (tomb !== undefined && !(Number(item._u || 0) > tomb)) continue; // someone deleted it
    seen.add(item.id);
    const existing = storedById.get(item.id);
    out.push(existing && Number(existing._u || 0) > Number(item._u || 0) ? existing : item);
  }
  for (const r of stored) {
    if (seen.has(r.id)) continue;
    if (tombstones[r.id] !== undefined) continue; // deleted on purpose
    out.push(r); // added by someone else since this browser last looked
  }
  return out;
}

// When a collection's file last changed (milliseconds). The browsers use this
// to know whether anything new is worth downloading.
export function collectionVersion(name: string): number {
  try { return Math.round(fs.statSync(filePath(name)).mtimeMs); } catch { return 0; }
}

// A tiny raw string store, used for the CEO PIN (not an array/collection).
export function readRaw(key: string, fallback: string): string {
  const fp = filePath(key);
  if (!fs.existsSync(fp)) return fallback;
  try {
    const val = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return typeof val === 'string' && val ? val : fallback;
  } catch {
    return fallback;
  }
}

export function writeRaw(key: string, value: string): Promise<void> {
  const prev = writeQueues[key] || Promise.resolve();
  const next = prev.then(() => {
    fs.writeFileSync(filePath(key), JSON.stringify(value));
  });
  writeQueues[key] = next.catch(() => {});
  return next;
}


// Small JSON settings files (not lists of records), e.g. the WhatsApp report
// settings. Written in one step so a crash can't leave half a file.
export function readJsonFile<T>(name: string, fallback: T): T {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')) as T; } catch { return fallback; }
}

export function writeJsonFile(name: string, value: unknown): void {
  const fp = filePath(name);
  fs.writeFileSync(`${fp}.tmp`, JSON.stringify(value, null, 2));
  fs.renameSync(`${fp}.tmp`, fp);
}
