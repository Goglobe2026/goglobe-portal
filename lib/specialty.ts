import type { Lead, Case, TeamMember, Specialty } from './types';

// ---------------------------------------------------------------------------
// Desks (specialties). Some people only work UK files, some only Europe (Schengen,
// Türkiye), some Australia / USA / Canada (and New Zealand). Someone with no
// specialty set is an all-rounder and can take anything. Nothing is ever blocked:
// the desks decide who is SUGGESTED first and who the auto-assign picks.
// ---------------------------------------------------------------------------

export const SPECIALTIES: Specialty[] = ['UK', 'Europe', 'Australia, US & Canada'];
export const SPECIALTY_NOTE: Record<Specialty, string> = {
  'UK': 'United Kingdom files',
  'Europe': 'Schengen and Türkiye files',
  'Australia, US & Canada': 'Australia, USA, Canada and New Zealand files',
};

const DESK: Record<string, Specialty> = {
  'UK': 'UK',
  'Schengen': 'Europe', 'Türkiye': 'Europe', 'Turkiye': 'Europe', 'Turkey': 'Europe',
  'Australia': 'Australia, US & Canada', 'USA': 'Australia, US & Canada', 'Canada': 'Australia, US & Canada', 'New Zealand': 'Australia, US & Canada',
};
// Destinations outside the three desks (UAE, Malaysia…) belong to nobody's desk — all-rounders take them.
export function deskOf(destination: string | undefined): Specialty | null {
  return DESK[(destination || '').trim()] || null;
}

export type Fit = 'specialist' | 'allrounder' | 'other';
type Person = Pick<TeamMember, 'id' | 'name' | 'specialties'>;
export function fitFor(p: Pick<TeamMember, 'specialties'>, destination: string | undefined): Fit {
  const mine = p.specialties || [];
  if (!mine.length) return 'allrounder';
  const desk = deskOf(destination);
  return desk && mine.includes(desk) ? 'specialist' : 'other';
}
export const specialtyLabel = (p: Pick<TeamMember, 'specialties'>) => (p.specialties && p.specialties.length ? p.specialties.join(' + ') : 'All-rounder');

// Open work a person is carrying: leads still being worked and cases not finished.
export function workloadOf(staffId: string, leads: Lead[], cases: Case[]): number {
  return leads.filter(l => l.assignedTo === staffId && l.stage !== 'Converted' && l.stage !== 'Lost').length
    + cases.filter(c => c.consultant === staffId && c.status === 'Active').length;
}

const RANK: Record<Fit, number> = { specialist: 0, allrounder: 1, other: 2 };
// Best fit first: the desk's specialists, then all-rounders, then everybody else; lighter workload first.
export function rankStaff<T extends Person>(staff: T[], destination: string | undefined, load: (id: string) => number = () => 0): T[] {
  return staff.slice().sort((a, b) =>
    RANK[fitFor(a, destination)] - RANK[fitFor(b, destination)] || load(a.id) - load(b.id) || a.name.localeCompare(b.name));
}
// The person who should get a new file for this destination, or null if only people from other desks are left.
export function pickAssignee<T extends Person>(staff: T[], destination: string | undefined, load: (id: string) => number = () => 0): T | null {
  const best = rankStaff(staff, destination, load)[0];
  return best && fitFor(best, destination) !== 'other' ? best : null;
}

export interface AutoAssignResult { leads: Lead[]; assigned: number; skipped: number; byDesk: Record<string, number> }
// Gives every unassigned, open lead (all of them, or just those in `only`) to the best-fit person, spreading the load as it goes.
export function autoAssign(leads: Lead[], staff: Person[], cases: Case[], only?: Set<string>): AutoAssignResult {
  const load = new Map<string, number>(staff.map(s => [s.id, workloadOf(s.id, leads, cases)]));
  const byDesk: Record<string, number> = {};
  let assigned = 0, skipped = 0;
  const out = leads.map(l => {
    if (l.assignedTo || l.stage === 'Converted' || l.stage === 'Lost' || (only && !only.has(l.id))) return l;
    const who = pickAssignee(staff, l.destination, id => load.get(id) || 0);
    if (!who) { skipped++; return l; }
    load.set(who.id, (load.get(who.id) || 0) + 1);
    assigned++;
    const desk = deskOf(l.destination) || 'Other countries';
    byDesk[desk] = (byDesk[desk] || 0) + 1;
    return { ...l, assignedTo: who.id };
  });
  return { leads: assigned ? out : leads, assigned, skipped, byDesk };
}

export interface DeskRow { desk: Specialty | 'All-rounders'; people: Person[]; openLeads: number; activeCases: number }
// Who is on which desk and how much is on it — for a quick look at balance.
export function deskTable(staff: Person[], leads: Lead[], cases: Case[]): DeskRow[] {
  const rows: DeskRow[] = [...SPECIALTIES, 'All-rounders' as const].map(desk => ({ desk, people: [], openLeads: 0, activeCases: 0 }));
  for (const s of staff) {
    const mine = s.specialties || [];
    const targets = mine.length ? rows.filter(r => mine.includes(r.desk as Specialty)) : rows.filter(r => r.desk === 'All-rounders');
    for (const r of targets) r.people.push(s);
  }
  for (const r of rows) {
    const ids = new Set(r.people.map(p => p.id));
    r.openLeads = leads.filter(l => ids.has(l.assignedTo) && l.stage !== 'Converted' && l.stage !== 'Lost').length;
    r.activeCases = cases.filter(c => ids.has(c.consultant) && c.status === 'Active').length;
  }
  return rows;
}
