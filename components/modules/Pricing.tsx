'use client';
import { useAppData } from '@/lib/AppDataContext';
import { money } from '@/lib/constants';
import { SectionHead } from '@/components/ui/Primitives';

export function Pricing() {
  const { rateCard, setRateCard } = useAppData();

  function update(id: string, field: 'consultFee' | 'visaFee' | 'apptFee', val: string) {
    setRateCard(prev => prev.map(r => r.id === id ? { ...r, [field]: Number(val) || 0 } : r));
  }

  return (
    <div>
      <SectionHead title="Rate card" count={`${rateCard.length} destination/visa combinations`} />
      <div className="card mb-3.5" style={{ background: 'var(--navy-50)' }}>
        <div className="text-[12.5px]" style={{ color: 'var(--navy)' }}>These are starting defaults — replace every number with your real pricing. New cases auto-fill from here (still editable per client).</div>
      </div>
      <div className="card p-0 overflow-auto">
        <table>
          <thead><tr><th>Destination</th><th>Visa type</th><th>Consultation fee</th><th>Visa service fee</th><th>Appointment fee</th><th>Total</th></tr></thead>
          <tbody>
            {rateCard.map(r => (
              <tr key={r.id}>
                <td className="font-medium">{r.destination}</td><td>{r.visaType}</td>
                <td><input className="font-mono-ui w-24" type="number" value={r.consultFee} onChange={e => update(r.id, 'consultFee', e.target.value)} /></td>
                <td><input className="font-mono-ui w-24" type="number" value={r.visaFee} onChange={e => update(r.id, 'visaFee', e.target.value)} /></td>
                <td><input className="font-mono-ui w-24" type="number" value={r.apptFee} onChange={e => update(r.id, 'apptFee', e.target.value)} /></td>
                <td className="font-mono-ui text-xs">{money(r.consultFee + r.visaFee + r.apptFee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
