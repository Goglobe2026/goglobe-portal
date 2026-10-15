import type { Case, GroupTour, TourMember, FamilyMember } from './types';

// ---------------------------------------------------------------------------
// Putting a visa case (single client or a whole family file) on a group tour.
// The travellers are made from the case, so nobody types a name twice, and every
// traveller gets the same id every time — adding the same case again, or from two
// screens at once, can never register anybody twice.
// ---------------------------------------------------------------------------

export const tourMemberId = (caseId: string, personId: string) => `tmb_${caseId}_${personId}`;

export interface TourPerson { personId: string; name: string; relation: string; passportNo: string }
// The head of the file and every family member on it.
export function peopleOnCase(c: Pick<Case, 'name' | 'familyMembers'>): TourPerson[] {
  const head: TourPerson = { personId: 'head', name: (c.name || '').trim(), relation: 'Head of family', passportNo: '' };
  const rest = (c.familyMembers || [])
    .filter((m: FamilyMember) => (m.name || '').trim())
    .map((m: FamilyMember) => ({ personId: m.id, name: m.name.trim(), relation: m.relation || 'Other', passportNo: m.passportNo || '' }));
  return [head, ...rest].filter(p => p.name);
}

// Reference codes in a tour run GG-<tour code>-001, 002, … — carry on from the highest one used.
function nextSeq(tour: GroupTour, existing: TourMember[]): number {
  let max = 0;
  const prefix = `GG-${tour.tourCode}-`;
  for (const m of existing) {
    if (m.tourId !== tour.id || !m.referenceCode.startsWith(prefix)) continue;
    const n = parseInt(m.referenceCode.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return Math.max(max, existing.filter(m => m.tourId === tour.id).length) + 1;
}

export interface CaseOnTour {
  added: TourMember[];     // travellers that were not on the tour yet
  already: number;         // people of this case that were already on the tour
  overCapacity: number;    // how many places beyond the tour's capacity this takes it to (0 = fits)
}

// Which travellers must be created to have this case on the tour. Pure: returns the new
// members, the caller saves them.
export function travellersForCase(c: Case, tour: GroupTour, existing: TourMember[], todayStr: string): CaseOnTour {
  const people = peopleOnCase(c);
  const onTour = existing.filter(m => m.tourId === tour.id);
  const have = new Set(onTour.map(m => m.id));
  const added: TourMember[] = [];
  let seq = nextSeq(tour, existing);
  let already = 0;
  for (const p of people) {
    const id = tourMemberId(c.id, p.personId);
    if (have.has(id)) { already++; continue; }
    added.push({
      id, tourId: tour.id, referenceCode: `GG-${tour.tourCode}-${String(seq++).padStart(3, '0')}`,
      name: p.name, fatherName: '', phone: c.phone || '', whatsapp: c.phone || '', email: '', cnic: '',
      passportNumber: p.passportNo, passportExpiry: '', nationality: 'Pakistani', emergencyContact: '', address: '',
      paid: 0, totalDue: tour.packagePrice || 0, status: 'Registered', bookingDate: todayStr,
      caseId: c.id, familyHead: people[0]?.name || c.name, familySize: people.length,
    });
  }
  const after = onTour.length + added.length;
  return { added, already, overCapacity: tour.capacity > 0 ? Math.max(0, after - tour.capacity) : 0 };
}

// Tours a case is on (from the travellers made out of it).
export function toursOfCase(caseId: string, members: TourMember[]): string[] {
  return [...new Set(members.filter(m => m.caseId === caseId).map(m => m.tourId))];
}

// Travellers of one tour with families kept together, in the order they joined.
export interface TourGroup { key: string; head: string; caseId?: string; members: TourMember[] }
export function groupTravellers(members: TourMember[]): TourGroup[] {
  const groups: TourGroup[] = [];
  const byCase = new Map<string, TourGroup>();
  for (const m of members) {
    if (m.caseId) {
      let g = byCase.get(m.caseId);
      if (!g) { g = { key: m.caseId, head: m.familyHead || m.name, caseId: m.caseId, members: [] }; byCase.set(m.caseId, g); groups.push(g); }
      g.members.push(m);
    } else groups.push({ key: m.id, head: m.name, members: [m] });
  }
  return groups;
}
