import { readCollection, updateCollectionSync } from './store';
import { assignQueryNos, postDueOutlays } from './caseBook';
import { today } from './constants';
import type { Case } from './types';

// Server side of the case numbers and the payouts that go into Expenses.

// Gives every saved case a query number (GG01…) — runs when the cases are read and when
// the server starts, so an old case list gets numbered the first time anyone opens it.
export function ensureQueryNos(): void {
  updateCollectionSync('cases', current => assignQueryNos(current as Case[], Date.now()) as any);
}

// Numbers the cases a browser is saving. Numbers that are already saved on the server are
// never taken away: if a new case in the browser picked a number someone else already got,
// the new case gets the next one.
export function numberIncoming(incoming: Case[], stored: Case[]): Case[] {
  const now = Date.now();
  const inIds = new Set(incoming.map(c => c.id));
  const storedById = new Map(stored.map(c => [c.id, c]));
  const combined = [...stored.filter(s => !inIds.has(s.id)), ...incoming];
  const firm = (c: Case) => !!c.queryNo && storedById.get(c.id)?.queryNo === c.queryNo;
  const done = assignQueryNos(combined, now, firm);
  if (done === combined) return incoming;
  const byId = new Map(done.map(c => [c.id, c]));
  return incoming.map(c => byId.get(c.id) || c);
}

// Adds to Expenses every payout (embassy / appointment fee…) whose date has come. Runs every
// minute with the lead-sync clock, and again whenever the portal is opened.
export function postOutlaysIfDue(): number {
  const cases = readCollection('cases') as Case[];
  if (!cases.some(c => (c.outlays || []).some(o => !o.posted && o.date))) return 0;
  const tx = readCollection('transactions');
  const r = postDueOutlays(cases, tx, today(), Date.now());
  if (r.transactions !== tx) updateCollectionSync('transactions', () => r.transactions as any);
  if (r.cases !== cases) {
    // keep whatever else changed in the meantime: only the outlay flags are taken from our copy
    updateCollectionSync('cases', cur => {
      const mine = new Map(r.cases.map(c => [c.id, c]));
      let changed = false;
      const next = (cur as Case[]).map(c => {
        const m = mine.get(c.id);
        if (!m || m === cases.find(x => x.id === c.id)) return c;
        const outlays = (c.outlays || []).map(o => { const mo = (m.outlays || []).find(x => x.id === o.id); return mo && mo.posted && !o.posted ? mo : o; });
        if (JSON.stringify(outlays) === JSON.stringify(c.outlays)) return c;
        changed = true;
        return { ...c, outlays, _u: Date.now() };
      });
      return (changed ? next : cur) as any;
    });
  }
  return r.posted;
}
