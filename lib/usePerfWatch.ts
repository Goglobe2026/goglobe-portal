'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from './AppDataContext';
import { today } from './constants';
import { computePerf, DEFAULT_PERF_CONFIG, cleanPerfConfig, type PerfConfig, type PerfHistory, type PerfInput, type TeamPerf } from './perfWatch';

// Settings and history come from the server (a small shared request); the
// flags themselves are worked out here from the live lists, so they are always
// as fresh as the screen.
interface Meta { config: PerfConfig; history: PerfHistory; admin: boolean }
let metaCache: { at: number; value: Meta } | null = null;
let metaInflight: Promise<Meta | null> | null = null;

function loadMeta(force = false): Promise<Meta | null> {
  if (!force && metaCache && Date.now() - metaCache.at < 60_000) return Promise.resolve(metaCache.value);
  if (metaInflight) return metaInflight;
  metaInflight = fetch('/api/perf-watch', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(j => {
      if (!j) return null;
      const value: Meta = { config: cleanPerfConfig(j.config), history: j.history || {}, admin: !!j.admin };
      metaCache = { at: Date.now(), value };
      return value;
    })
    .catch(() => null)
    .finally(() => { metaInflight = null; });
  return metaInflight;
}

// Many cards on one screen ask for the same numbers — work them out once per change.
let memo: { deps: unknown[]; value: TeamPerf } | null = null;
function computeMemo(input: PerfInput, todayIso: string, cfg: PerfConfig): TeamPerf {
  const deps = [input.team, input.leads, input.cases, input.transactions, input.attendance, input.requests, input.staffTargets, input.qcChecks, input.appointments, todayIso, cfg];
  if (memo && memo.deps.length === deps.length && memo.deps.every((d, i) => d === deps[i])) return memo.value;
  const value = computePerf(input, todayIso, cfg);
  memo = { deps, value };
  return value;
}

export function usePerfWatch() {
  const { team, leads, cases, transactions, attendance, requests, staffTargets, qcChecks, appointments } = useAppData();
  const [meta, setMeta] = useState<Meta | null>(metaCache?.value || null);

  useEffect(() => {
    let alive = true;
    loadMeta().then(m => { if (alive && m) setMeta(m); });
    const id = setInterval(() => { loadMeta(true).then(m => { if (alive && m) setMeta(m); }); }, 5 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const reload = useCallback(async () => {
    const m = await loadMeta(true);
    if (m) setMeta(m);
  }, []);

  const config = meta?.config || DEFAULT_PERF_CONFIG;
  const todayIso = today();
  const perf = useMemo(
    () => computeMemo({ team, leads, cases, transactions, attendance, requests, staffTargets, qcChecks, appointments }, todayIso, config),
    [team, leads, cases, transactions, attendance, requests, staffTargets, qcChecks, appointments, todayIso, config],
  );
  return { perf, config, history: meta?.history || ({} as PerfHistory), todayIso, loaded: !!meta, reload };
}
