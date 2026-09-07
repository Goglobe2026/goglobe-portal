import fs from 'fs';
import path from 'path';
import type { Collections, CollectionName } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
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
