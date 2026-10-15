'use client';
import { useState, Fragment } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today, REGIONS, REGION_COUNTRIES } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { QrCode } from '@/components/ui/QrCode';
import { useToast } from '@/components/ui/Toast';
import type { GroupTour, TourMember, Case } from '@/lib/types';
import { travellersForCase, groupTravellers, peopleOnCase } from '@/lib/tourLink';
import { sortLatest } from '@/lib/caseBook';
import { readFileAsDataUrl, MAX_PDF_BYTES } from '@/lib/fileUpload';

const TOUR_STATUSES = ['Open', 'Limited Seats', 'Full', 'Closed'] as const;
const MEMBER_STATUSES = ['Registered', 'Partially Paid', 'Fully Paid', 'Documentation Complete', 'Travel Confirmed', 'Cancelled'] as const;

function genTourCode(destination: string, existingTours: GroupTour[]) {
  const destCode = destination.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GRP';
  const year = new Date().getFullYear();
  const prefix = `${destCode}-${year}`;
  const count = existingTours.filter(t => t.tourCode.startsWith(prefix)).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}
function genMemberCode(tourCode: string, existingMembersInTour: TourMember[]) {
  return `GG-${tourCode}-${String(existingMembersInTour.length + 1).padStart(3, '0')}`;
}

export function GroupTours() {
  const { groupTours } = useAppData();
  const [openTourId, setOpenTourId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  if (openTourId) return <TourDetail tourId={openTourId} onBack={() => setOpenTourId(null)} />;

  return (
    <div>
      <SectionHead title="Group tours" count={`${groupTours.length} tours`} action={
        <button className="btn btn-primary ml-auto" onClick={() => setShowNew(true)}>+ Create new group tour</button>
      } />
      {!groupTours.length ? (
        <EmptyState title="No group tours yet" body="Create your first tour to start registering travelers and generating verification codes." />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
          {groupTours.map(t => <TourCard key={t.id} tour={t} onOpen={() => setOpenTourId(t.id)} />)}
        </div>
      )}
      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <NewTourForm onClose={() => setShowNew(false)} onCreated={(id) => setOpenTourId(id)} />
      </Modal>
    </div>
  );
}

function TourCard({ tour, onOpen }: { tour: GroupTour; onOpen: () => void }) {
  const { tourMembers } = useAppData();
  const members = tourMembers.filter(m => m.tourId === tour.id);
  const pct = tour.capacity ? Math.round((members.length / tour.capacity) * 100) : 0;
  return (
    <div className="card cursor-pointer" onClick={onOpen}>
      <div className="flex justify-between items-start mb-1">
        <div className="font-mono-ui text-[11px] text-[var(--faint)]">{tour.tourCode}</div>
        <Stamp text={tour.status} />
      </div>
      <div className="font-display font-semibold text-[15px]">{tour.name}</div>
      <div className="text-[var(--muted)] text-xs mt-0.5">{tour.destination} · {fmtDate(tour.startDate)} – {fmtDate(tour.endDate)}</div>
      <div className="mt-3">
        <div className="flex justify-between text-[11.5px] text-[var(--muted)] mb-1"><span>{members.length}/{tour.capacity} registered</span><span>{pct}%</span></div>
        <div className="rounded-md h-2 overflow-hidden" style={{ background: 'var(--navy-50)' }}>
          <div className="h-full rounded-md" style={{ width: `${Math.min(100, pct)}%`, background: 'linear-gradient(90deg,var(--navy),var(--navy-light))' }} />
        </div>
      </div>
    </div>
  );
}

function NewTourForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { groupTours, setGroupTours } = useAppData();
  const toast = useToast();
  const [name, setName] = useState('');
  const [region, setRegion] = useState<string>(REGIONS[0]);
  const [countries, setCountries] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(today()); const [endDate, setEndDate] = useState(today());
  const [capacity, setCapacity] = useState(30); const [packagePrice, setPackagePrice] = useState(0);
  const [description, setDescription] = useState('');
  const [planPdf, setPlanPdf] = useState(''); const [planPdfName, setPlanPdfName] = useState('');

  function toggleCountry(c: string) {
    setCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }
  async function handlePdfPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Please choose a PDF file'); return; }
    if (file.size > MAX_PDF_BYTES) { toast('PDF is too large — please keep it under 4MB'); return; }
    const dataUrl = await readFileAsDataUrl(file);
    setPlanPdf(dataUrl); setPlanPdfName(file.name);
  }

  function save() {
    const destination = countries.join(', ');
    if (!name.trim() || !destination) { toast('Enter a tour name and pick at least one country'); return; }
    const id = genId('gt');
    const tourCode = genTourCode(destination, groupTours);
    setGroupTours(prev => [...prev, {
      id, tourCode, name, region, destination, startDate, endDate, capacity, packagePrice,
      status: 'Open', description, includedServices: [], planPdf, planPdfName, createdAt: today(),
    }]);
    toast('Tour created');
    onCreated(id);
  }

  return (
    <>
      <ModalTitle>Create new group tour</ModalTitle>
      <Field label="Tour name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 2027 Europe New Year Group Tour" /></Field>
      <Field label="Region">
        <select value={region} onChange={e => { setRegion(e.target.value); setCountries([]); }}>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <div className="mb-3">
        <label>Countries in this tour</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {REGION_COUNTRIES[region].map(c => (
            <button key={c} type="button" className="btn btn-sm" onClick={() => toggleCountry(c)}
              style={countries.includes(c) ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}}>
              {c}
            </button>
          ))}
        </div>
        <div className="text-[11.5px] text-[var(--faint)] mt-1">{countries.length ? countries.join(', ') : 'Pick one or more countries this tour visits'}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Departure date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
        <Field label="Return date"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capacity (total slots)"><input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></Field>
        <Field label="Package price per person (PKR)"><input type="number" value={packagePrice} onChange={e => setPackagePrice(Number(e.target.value))} /></Field>
      </div>
      <Field label="Description"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <Field label="Trip plan PDF (optional, under 4MB)">
        <input type="file" accept="application/pdf" onChange={handlePdfPick} />
        {planPdfName && <div className="text-[11.5px] mt-1" style={{ color: 'var(--green)' }}>Attached: {planPdfName}</div>}
      </Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Create tour</button>
      </ModalFoot>
    </>
  );
}

function EditTourForm({ tour, onClose }: { tour: GroupTour; onClose: () => void }) {
  const { setGroupTours, logActivity } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(tour.name);
  const [region, setRegion] = useState<string>(tour.region && REGIONS.includes(tour.region) ? tour.region : REGIONS[0]);
  const [countries, setCountries] = useState<string[]>(tour.destination ? tour.destination.split(',').map(s => s.trim()).filter(Boolean) : []);
  const [startDate, setStartDate] = useState(tour.startDate); const [endDate, setEndDate] = useState(tour.endDate);
  const [capacity, setCapacity] = useState(tour.capacity); const [packagePrice, setPackagePrice] = useState(tour.packagePrice);
  const [status, setStatus] = useState<GroupTour['status']>(tour.status);
  const [description, setDescription] = useState(tour.description);
  const [planPdf, setPlanPdf] = useState(tour.planPdf || ''); const [planPdfName, setPlanPdfName] = useState(tour.planPdfName || '');

  function toggleCountry(c: string) {
    setCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }
  async function handlePdfPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Please choose a PDF file'); return; }
    if (file.size > MAX_PDF_BYTES) { toast('PDF is too large — please keep it under 4MB'); return; }
    const dataUrl = await readFileAsDataUrl(file);
    setPlanPdf(dataUrl); setPlanPdfName(file.name);
  }
  function removePdf() { setPlanPdf(''); setPlanPdfName(''); }

  function save() {
    const destination = countries.join(', ');
    if (!name.trim() || !destination) { toast('Enter a tour name and pick at least one country'); return; }
    setGroupTours(prev => prev.map(t => t.id === tour.id ? { ...t, name, region, destination, startDate, endDate, capacity, packagePrice, status, description, planPdf, planPdfName } : t));
    logActivity(`Updated tour details: ${name}`);
    toast('Tour updated');
    onClose();
  }

  return (
    <>
      <ModalTitle>Edit tour details</ModalTitle>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-3">The tour code ({tour.tourCode}) and any already-registered travelers stay exactly as they are — this only updates the tour's own details.</div>
      <Field label="Tour name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Region">
        <select value={region} onChange={e => { setRegion(e.target.value); setCountries([]); }}>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <div className="mb-3">
        <label>Countries in this tour</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {REGION_COUNTRIES[region].map(c => (
            <button key={c} type="button" className="btn btn-sm" onClick={() => toggleCountry(c)}
              style={countries.includes(c) ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Departure date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
        <Field label="Return date"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capacity (total slots)"><input type="number" value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></Field>
        <Field label="Package price per person (PKR)"><input type="number" value={packagePrice} onChange={e => setPackagePrice(Number(e.target.value))} /></Field>
      </div>
      <Field label="Status">
        <select value={status} onChange={e => setStatus(e.target.value as GroupTour['status'])}>
          {TOUR_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Description"><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <Field label="Trip plan PDF (optional, under 4MB)">
        <input type="file" accept="application/pdf" onChange={handlePdfPick} />
        {planPdfName && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11.5px]" style={{ color: 'var(--green)' }}>Attached: {planPdfName}</span>
            <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={removePdf}>Remove</button>
          </div>
        )}
      </Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save changes</button>
      </ModalFoot>
    </>
  );
}

function TourDetail({ tourId, onBack }: { tourId: string; onBack: () => void }) {
  const { groupTours, setGroupTours, tourMembers, setTourMembers, logActivity, cases } = useAppData();
  const toast = useToast();
  const tour = groupTours.find(t => t.id === tourId)!;
  const members = tourMembers.filter(m => m.tourId === tourId);
  const groups = groupTravellers(members);
  const queryOf = (caseId?: string) => cases.find(x => x.id === caseId)?.queryNo || '';
  const [showAddMember, setShowAddMember] = useState(false);
  const [showFromCases, setShowFromCases] = useState(false);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [showEditTour, setShowEditTour] = useState(false);

  const fullyPaid = members.filter(m => m.status === 'Fully Paid' || m.status === 'Travel Confirmed').length;
  const docsComplete = members.filter(m => m.status === 'Documentation Complete' || m.status === 'Travel Confirmed').length;

  function deleteTour() {
    setTourMembers(prev => prev.filter(m => m.tourId !== tourId));
    setGroupTours(prev => prev.filter(t => t.id !== tourId));
    logActivity(`Deleted tour: ${tour.name}`);
    toast('Tour and its travelers deleted');
    onBack();
  }

  return (
    <div>
      <button className="btn btn-sm mb-4" onClick={onBack}>← Back to all tours</button>
      <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="font-mono-ui text-xs text-[var(--faint)]">{tour.tourCode}</div>
          <h2 className="font-display text-xl font-semibold">{tour.name}</h2>
          <div className="text-[var(--muted)] text-sm mt-0.5">{tour.destination} · {fmtDate(tour.startDate)} – {fmtDate(tour.endDate)}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => setShowEditTour(true)}>Edit tour details</button>
          <button className="btn btn-sm btn-ghost btn-danger" onClick={deleteTour}>Delete this tour</button>
        </div>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] -mt-3 mb-4">Deleting a tour also deletes every traveler registered under it — their reference codes and QR links stop working immediately.</div>

      <Modal open={showEditTour} onClose={() => setShowEditTour(false)}>
        <EditTourForm tour={tour} onClose={() => setShowEditTour(false)} />
      </Modal>


      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1 mb-4">
        <div className="card"><div className="text-[11.5px] uppercase text-[var(--muted)] font-semibold">Registered</div><div className="font-display text-2xl font-semibold mt-1">{members.length}/{tour.capacity}</div></div>
        <div className="card"><div className="text-[11.5px] uppercase text-[var(--muted)] font-semibold">Fully paid</div><div className="font-display text-2xl font-semibold mt-1">{fullyPaid}</div></div>
        <div className="card"><div className="text-[11.5px] uppercase text-[var(--muted)] font-semibold">Docs complete</div><div className="font-display text-2xl font-semibold mt-1">{docsComplete}</div></div>
      </div>

      <SectionHead title="Registered travelers" count={`${members.length} in this group`} action={
        <span className="ml-auto flex gap-2">
          <button data-testid="tour-from-cases" className="btn" onClick={() => setShowFromCases(true)}>+ From a case / family</button>
          <button className="btn btn-primary" onClick={() => setShowAddMember(true)}>+ Add traveler</button>
        </span>
      } />
      {!members.length ? (
        <EmptyState title="No travelers registered yet" body="Add the first traveler to this tour to generate their verification code and QR." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Traveler</th><th>Reference</th><th>Payment</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {groups.map(g => (
                <Fragment key={g.key}>
                  {g.caseId && g.members.length > 1 && (
                    <tr data-testid="tour-family-row" style={{ background: 'var(--gold-50)' }}>
                      <td colSpan={5} style={{ fontSize: 12.5, fontWeight: 700, color: '#8a5a12' }}>
                        FAMILY — {g.head} · {g.members.length} travelers{queryOf(g.caseId) ? ` · ${queryOf(g.caseId)}` : ''}
                      </td>
                    </tr>
                  )}
                  {g.members.map(m => (
                    <tr key={m.id} data-testid="tour-member-row">
                      <td className="font-medium" style={g.caseId && g.members.length > 1 ? { paddingLeft: 26 } : undefined}>{m.name}
                        {m.caseId && g.members.length === 1 && queryOf(m.caseId) && <span className="ml-2 text-[11px] font-bold" style={{ color: '#8a5a12' }}>{queryOf(m.caseId)}</span>}
                        <div className="font-mono-ui text-xs text-[var(--muted)]">{m.phone}</div></td>
                      <td className="font-mono-ui text-xs">{m.referenceCode}</td>
                      <td className="font-mono-ui text-xs">{money(m.paid)} / {money(m.totalDue)}</td>
                      <td><Stamp text={m.status} /></td>
                      <td>
                        <div className="flex gap-1.5 justify-end">
                          <button className="btn btn-sm" onClick={() => setOpenMemberId(m.id)}>View profile</button>
                          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => { setTourMembers(prev => prev.filter(x => x.id !== m.id)); toast('Traveler removed'); }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAddMember} onClose={() => setShowAddMember(false)}>
        <AddMemberForm tour={tour} onClose={() => setShowAddMember(false)} />
      </Modal>
      <Modal open={showFromCases} onClose={() => setShowFromCases(false)} wide>
        {showFromCases && <AddFromCases tour={tour} onClose={() => setShowFromCases(false)} />}
      </Modal>
      <Modal open={!!openMemberId} onClose={() => setOpenMemberId(null)} wide>
        {openMemberId && <MemberProfile memberId={openMemberId} tour={tour} onClose={() => setOpenMemberId(null)} />}
      </Modal>
    </div>
  );
}

// Pick visa cases (single clients or whole family files) and put everyone on them on this tour.
function AddFromCases({ tour, onClose }: { tour: GroupTour; onClose: () => void }) {
  const { cases, setCases, tourMembers, setTourMembers, logActivity } = useAppData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [limit, setLimit] = useState(60);
  const onTourIds = new Set(tourMembers.filter(m => m.tourId === tour.id).map(m => m.id));
  const rows = sortLatest(cases).map(c => {
    const people = peopleOnCase(c);
    const there = people.filter(p => onTourIds.has(`tmb_${c.id}_${p.personId}`)).length;
    return { c, people: people.length, there };
  });
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(r => !needle || [r.c.name, r.c.queryNo || '', r.c.phone, r.c.destination, ...(r.c.familyMembers || []).map(m => m.name)].join(' ').toLowerCase().includes(needle));
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toAdd = picked.reduce((n, id) => { const r = rows.find(x => x.c.id === id); return n + (r ? r.people - r.there : 0); }, 0);
  const free = tour.capacity - onTourIds.size;

  function add() {
    if (!picked.length) { toast('Tick at least one case'); return; }
    let all: TourMember[] = [];
    let current = tourMembers;
    for (const id of picked) {
      const c = cases.find(x => x.id === id); if (!c) continue;
      const link = travellersForCase(c, tour, current, today());
      all = all.concat(link.added); current = current.concat(link.added);
    }
    if (!all.length) { toast('Everyone on those cases is already on this tour'); return; }
    setTourMembers(prev => { const have = new Set(prev.map(m => m.id)); return [...prev, ...all.filter(m => !have.has(m.id))]; });
    const ids = new Set(picked);
    setCases(prev => prev.map(c => ids.has(c.id) && c.tourId !== tour.id ? { ...c, tourId: tour.id } : c));
    logActivity(`${all.length} traveler${all.length === 1 ? '' : 's'} added to ${tour.name} from ${picked.length} case${picked.length === 1 ? '' : 's'}`);
    const over = Math.max(0, onTourIds.size + all.length - tour.capacity);
    toast(`${all.length} traveler${all.length === 1 ? '' : 's'} added${over ? ` — tour is now ${over} over capacity` : ''}`);
    onClose();
  }

  return (
    <>
      <ModalTitle>Add from cases — {tour.name}</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] -mt-1 mb-3">Tick a client or a family file: the head and every family member become travelers on this tour. People already on the tour are skipped. {free >= 0 ? `${free} seat${free === 1 ? '' : 's'} left.` : `Over capacity by ${-free}.`}</div>
      <input data-testid="tour-case-search" placeholder="Search by name, GG number, phone or destination…" value={q} onChange={e => { setQ(e.target.value); setLimit(60); }} className="mb-2.5" />
      <div className="overflow-auto rounded-[10px] border" style={{ borderColor: 'var(--line)', maxHeight: 360 }}>
        {shown.length === 0 && <div className="p-4 text-[13px] text-[var(--muted)]">No case matches.</div>}
        {shown.slice(0, limit).map(r => {
          const done = r.there >= r.people;
          return (
            <label key={r.c.id} data-testid="tour-case-row" className="flex items-center gap-3 px-3 py-2 border-b text-[13px]" style={{ borderColor: 'var(--line)', opacity: done ? 0.55 : 1, cursor: done ? 'default' : 'pointer' }}>
              <input type="checkbox" className="!w-auto" disabled={done} checked={picked.includes(r.c.id)} onChange={() => toggle(r.c.id)} />
              <span className="font-mono-ui text-[12px]" style={{ width: 46, color: '#14213D', fontWeight: 700 }}>{r.c.queryNo || '—'}</span>
              <span className="flex-1"><b>{r.c.name}</b>{r.people > 1 && <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--gold-50)', border: '1px solid #E8C784', color: '#8a5a12' }}>FAMILY · {r.people}</span>}
                <span className="text-[var(--muted)]"> · {r.c.destination} · {r.c.visaType}</span></span>
              <span className="text-[12px] text-[var(--muted)]">{done ? 'already on this tour' : r.there ? `${r.there} of ${r.people} on tour` : ''}</span>
            </label>
          );
        })}
        {shown.length > limit && <button type="button" className="btn btn-sm btn-ghost m-2" onClick={() => setLimit(l => l + 60)}>Show more ({shown.length - limit} left)</button>}
      </div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button data-testid="tour-case-add" className="btn btn-primary" onClick={add}>{toAdd ? `Add ${toAdd} traveler${toAdd === 1 ? '' : 's'}` : 'Add to tour'}</button>
      </ModalFoot>
    </>
  );
}

function AddMemberForm({ tour, onClose }: { tour: GroupTour; onClose: () => void }) {
  const { tourMembers, setTourMembers } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [totalDue, setTotalDue] = useState(tour.packagePrice);

  function save() {
    if (!name.trim() || !phone.trim()) { toast('Enter name and phone'); return; }
    const membersInTour = tourMembers.filter(m => m.tourId === tour.id);
    const referenceCode = genMemberCode(tour.tourCode, membersInTour);
    setTourMembers(prev => [...prev, {
      id: genId('tmb'), tourId: tour.id, referenceCode, name, fatherName: '', phone, whatsapp: phone,
      email: '', cnic: '', passportNumber: '', passportExpiry: '', nationality: 'Pakistani',
      emergencyContact: '', address: '', paid: 0, totalDue, status: 'Registered', bookingDate: today(),
    }]);
    toast('Traveler added — reference code generated');
    onClose();
  }

  return (
    <>
      <ModalTitle>Add traveler — {tour.name}</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Total package cost for this traveler (PKR)"><input type="number" value={totalDue} onChange={e => setTotalDue(Number(e.target.value))} /></Field>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-3">More details (passport, CNIC, emergency contact) can be added from their profile after saving.</div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Add traveler</button>
      </ModalFoot>
    </>
  );
}

function MemberProfile({ memberId, tour, onClose }: { memberId: string; tour: GroupTour; onClose: () => void }) {
  const { tourMembers, setTourMembers } = useAppData();
  const toast = useToast();
  const m = tourMembers.find(x => x.id === memberId)!;
  const [fatherName, setFatherName] = useState(m.fatherName); const [cnic, setCnic] = useState(m.cnic);
  const [passportNumber, setPassportNumber] = useState(m.passportNumber); const [passportExpiry, setPassportExpiry] = useState(m.passportExpiry);
  const [email, setEmail] = useState(m.email); const [emergencyContact, setEmergencyContact] = useState(m.emergencyContact);
  const [address, setAddress] = useState(m.address); const [status, setStatus] = useState(m.status);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const verifyUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify/${m.referenceCode}` : `/verify/${m.referenceCode}`;

  function save() {
    setTourMembers(prev => prev.map(x => x.id === m.id ? { ...x, fatherName, cnic, passportNumber, passportExpiry, email, emergencyContact, address, status } : x));
    toast('Profile saved');
  }
  function recordPayment() {
    if (paymentAmount <= 0) { toast('Enter an amount'); return; }
    setTourMembers(prev => prev.map(x => x.id === m.id ? { ...x, paid: x.paid + paymentAmount } : x));
    toast('Payment recorded');
    setPaymentAmount(0);
  }

  return (
    <>
      <div className="flex justify-between items-start mb-1">
        <div>
          <div className="font-mono-ui text-xs text-[var(--faint)]">{m.referenceCode}</div>
          <h3 className="font-display text-lg font-semibold m-0">{m.name}</h3>
        </div>
        <Stamp text={m.status} />
      </div>
      <div className="text-[12.5px] text-[var(--muted)] mb-4">{tour.name} · {m.referenceCode}</div>

      <div className="grid grid-cols-[1fr_180px] gap-5 max-md:grid-cols-1">
        <div>
          <SectionHead title="Traveler details" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Father's / guardian's name"><input value={fatherName} onChange={e => setFatherName(e.target.value)} /></Field>
            <Field label="CNIC / National ID"><input value={cnic} onChange={e => setCnic(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Passport number"><input value={passportNumber} onChange={e => setPassportNumber(e.target.value)} /></Field>
            <Field label="Passport expiry"><input type="date" value={passportExpiry} onChange={e => setPassportExpiry(e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label="Emergency contact"><input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} /></Field>
          </div>
          <Field label="Address"><input value={address} onChange={e => setAddress(e.target.value)} /></Field>
          <Field label="Status">
            <select value={status} onChange={e => setStatus(e.target.value as TourMember['status'])}>
              {MEMBER_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>

          <SectionHead title="Payments" count={`Paid ${money(m.paid)} · Remaining ${money(Math.max(0, m.totalDue - m.paid))}`} />
          <div className="flex gap-2 mb-3">
            <input type="number" placeholder="Amount" value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} />
            <button className="btn btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={recordPayment}>+ Record payment</button>
          </div>

          <ModalFoot>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={save}>Save changes</button>
          </ModalFoot>
        </div>

        <div className="text-center">
          <div className="text-[11.5px] uppercase text-[var(--muted)] font-semibold mb-2">Verification QR</div>
          <QrCode value={verifyUrl} size={160} />
          <div className="font-mono-ui text-[10px] text-[var(--faint)] mt-2 break-all">{verifyUrl}</div>
          <a className="btn btn-sm w-full mt-3 block text-center" href={`/verify/${m.referenceCode}`} target="_blank">View verification page</a>
        </div>
      </div>
    </>
  );
}
