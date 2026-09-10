'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, DESTINATIONS, visaTypesFor, genId } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

export function Pricing() {
  const { rateCard, setRateCard } = useAppData();
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  function update(id: string, field: 'consultFee' | 'visaFee' | 'apptFee', val: string) {
    setRateCard(prev => prev.map(r => r.id === id ? { ...r, [field]: Number(val) || 0 } : r));
  }
  function remove(id: string) {
    setRateCard(prev => prev.filter(r => r.id !== id));
    toast('Rate removed');
  }

  return (
    <div>
      <SectionHead title="Rate card" count={`${rateCard.length} destination/visa combinations`} action={
        <button className="btn btn-primary ml-auto" onClick={() => setShowNew(true)}>+ Add new rate</button>
      } />
      <div className="card mb-3.5" style={{ background: 'var(--navy-50)' }}>
        <div className="text-[12.5px]" style={{ color: 'var(--navy)' }}>These are starting defaults — replace every number with your real pricing. New cases auto-fill from here (still editable per client). Use "+ Add new rate" for a country or visa type not listed yet.</div>
      </div>
      {!rateCard.length ? (
        <div className="card text-center py-9 px-3 text-[var(--muted)]">
          <b className="block font-display text-[15px] font-semibold text-[var(--ink)] mb-1">No pricing set up yet</b>
          Click &quot;+ Add new rate&quot; above to start entering your own pricing, destination by destination.
        </div>
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Destination</th><th>Visa type</th><th>Consultation fee</th><th>Visa service fee</th><th>Appointment fee</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {rateCard.map(r => (
                <tr key={r.id}>
                  <td className="font-medium">{r.destination}</td><td>{r.visaType}</td>
                  <td><input className="font-mono-ui w-24" type="number" value={r.consultFee} onChange={e => update(r.id, 'consultFee', e.target.value)} /></td>
                  <td><input className="font-mono-ui w-24" type="number" value={r.visaFee} onChange={e => update(r.id, 'visaFee', e.target.value)} /></td>
                  <td><input className="font-mono-ui w-24" type="number" value={r.apptFee} onChange={e => update(r.id, 'apptFee', e.target.value)} /></td>
                  <td className="font-mono-ui text-xs">{money(r.consultFee + r.visaFee + r.apptFee)}</td>
                  <td><button className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(r.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <NewRateForm onClose={() => setShowNew(false)} />
      </Modal>
    </div>
  );
}

function NewRateForm({ onClose }: { onClose: () => void }) {
  const { rateCard, setRateCard } = useAppData();
  const toast = useToast();
  const [destination, setDestination] = useState<string>(DESTINATIONS[0]);
  const [visaType, setVisaType] = useState<string>(visaTypesFor(DESTINATIONS[0])[0]);
  const [consultFee, setConsultFee] = useState(0);
  const [visaFee, setVisaFee] = useState(0);
  const [apptFee, setApptFee] = useState(0);

  function changeDestination(d: string) {
    setDestination(d);
    setVisaType(visaTypesFor(d)[0]);
  }

  function save() {
    const exists = rateCard.some(r => r.destination === destination && r.visaType === visaType);
    if (exists) { toast('That destination and visa type already has a rate — edit it in the table instead'); return; }
    setRateCard(prev => [...prev, { id: genId('rc'), destination, visaType, consultFee, visaFee, apptFee }]);
    toast('Rate added');
    onClose();
  }

  return (
    <>
      <ModalTitle>Add new rate</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Destination">
          <select value={destination} onChange={e => changeDestination(e.target.value)}>
            {DESTINATIONS.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Visa type">
          <select value={visaType} onChange={e => setVisaType(e.target.value)}>
            {visaTypesFor(destination).map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Consultation fee"><input type="number" value={consultFee} onChange={e => setConsultFee(Number(e.target.value))} /></Field>
        <Field label="Visa service fee"><input type="number" value={visaFee} onChange={e => setVisaFee(Number(e.target.value))} /></Field>
        <Field label="Appointment fee"><input type="number" value={apptFee} onChange={e => setApptFee(Number(e.target.value))} /></Field>
      </div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save rate</button>
      </ModalFoot>
    </>
  );
}
