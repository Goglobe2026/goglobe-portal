'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today, REGIONS, REGION_COUNTRIES } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { QrCode } from '@/components/ui/QrCode';
import { useToast } from '@/components/ui/Toast';
import type { GroupTour, TourMember } from '@/lib/types';
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
  const { groupTours, setGroupTours, tourMembers, setTourMembers, logActivity } = useAppData();
  const toast = useToast();
  const tour = groupTours.find(t => t.id === tourId)!;
  const members = tourMembers.filter(m => m.tourId === tourId);
  const [showAddMember, setShowAddMember] = useState(false);
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
        <button className="btn btn-primary ml-auto" onClick={() => setShowAddMember(true)}>+ Add traveler</button>
      } />
      {!members.length ? (
        <EmptyState title="No travelers registered yet" body="Add the first traveler to this tour to generate their verification code and QR." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Traveler</th><th>Reference</th><th>Payment</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}<div className="font-mono-ui text-xs text-[var(--muted)]">{m.phone}</div></td>
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
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAddMember} onClose={() => setShowAddMember(false)}>
        <AddMemberForm tour={tour} onClose={() => setShowAddMember(false)} />
      </Modal>
      <Modal open={!!openMemberId} onClose={() => setOpenMemberId(null)} wide>
        {openMemberId && <MemberProfile memberId={openMemberId} tour={tour} onClose={() => setOpenMemberId(null)} />}
      </Modal>
    </div>
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
