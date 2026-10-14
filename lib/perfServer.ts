import { readCollection, readJsonFile, writeJsonFile } from './store';
import { computePerf, cleanPerfConfig, snapshotOf, addDaysIso, DEFAULT_PERF_CONFIG, PERF_CONFIG_KEYS, type PerfConfig, type PerfHistory, type PerfInput, type TeamPerf } from './perfWatch';
import { pktNow } from './reportSchedule';

// The watch's settings and its day-by-day history live in one small file next
// to the other data. The history is a snapshot per person per day, so a
// profile can show "flagged on 9 of the last 30 days" and not only today.
const FILE = 'perfwatch';
const KEEP_DAYS = 120;

export interface PerfFile { config: Partial<PerfConfig>; history: PerfHistory; lastSnapAt: number }

export function readPerfFile(): PerfFile {
  const f = readJsonFile<Partial<PerfFile>>(FILE, {});
  return { config: f.config && typeof f.config === 'object' ? f.config : {}, history: f.history && typeof f.history === 'object' ? f.history : {}, lastSnapAt: Number(f.lastSnapAt) || 0 };
}
const writePerfFile = (f: PerfFile) => writeJsonFile(FILE, f);

export const getPerfConfig = (): PerfConfig => cleanPerfConfig(readPerfFile().config);

// Only the settings that differ from the defaults are stored, so a future
// change to a default reaches everyone who never touched that setting.
export function setPerfConfig(patch: Partial<PerfConfig> | null): PerfConfig {
  const f = readPerfFile();
  if (patch === null) f.config = {};
  else {
    const merged = cleanPerfConfig({ ...cleanPerfConfig(f.config), ...patch });
    const diff: Partial<PerfConfig> = {};
    for (const k of PERF_CONFIG_KEYS) if (merged[k] !== DEFAULT_PERF_CONFIG[k]) diff[k] = merged[k];
    f.config = diff;
  }
  writePerfFile(f);
  return cleanPerfConfig(f.config);
}

export function loadPerfInput(): PerfInput {
  return {
    team: readCollection('team'), leads: readCollection('leads'), cases: readCollection('cases'), transactions: readCollection('transactions'),
    attendance: readCollection('attendance'), requests: readCollection('requests'), staffTargets: readCollection('stafftargets'), qcChecks: readCollection('qcchecks'),
    appointments: readCollection('appointments'),
  };
}

export function computeNow(nowMs = Date.now()): TeamPerf {
  return computePerf(loadPerfInput(), pktNow(nowMs).date, getPerfConfig());
}

// Writes today's picture into the history (the last one written on a day is the
// one kept), drops anything older than ~4 months. Does nothing if it ran less
// than `minGapMs` ago, so the timer and every opened screen can call it freely.
export function snapshotPerf(nowMs = Date.now(), minGapMs = 0): TeamPerf | null {
  const f = readPerfFile();
  if (minGapMs > 0 && nowMs - f.lastSnapAt < minGapMs) return null;
  const today = pktNow(nowMs).date;
  const perf = computePerf(loadPerfInput(), today, cleanPerfConfig(f.config));
  f.history[today] = snapshotOf(perf);
  const cutoff = addDaysIso(today, -KEEP_DAYS);
  for (const d of Object.keys(f.history)) if (d < cutoff) delete f.history[d];
  f.lastSnapAt = nowMs;
  writePerfFile(f);
  return perf;
}

export const snapshotPerfIfDue = (nowMs = Date.now()) => snapshotPerf(nowMs, Number(process.env.PERF_SNAPSHOT_GAP_MS) || 20 * 60_000);
