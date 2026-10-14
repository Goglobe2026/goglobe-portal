'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, genId, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { Case, Testimonial } from '@/lib/types';

export function Testimonials() {
  const { cases, testimonials, setTestimonials } = useAppData();
  const [addFor, setAddFor] = useState<Case | null>(null);
  const toast = useToast();

  const approved = cases.filter(c => c.status === 'Approved').length;
  const decided = cases.filter(c => c.status === 'Approved' || c.status === 'Refused').length;
  const approvalRate = decided ? Math.round((approved / decided) * 100) : 0;

  const approvedCases = cases.filter(c => c.status === 'Approved');
  const withoutStory = approvedCases.filter(c => !testimonials.some(t => t.caseId === c.id));

  function toggleFeatured(id: string) {
    setTestimonials(prev => prev.map(t => t.id === id ? { ...t, featured: !t.featured } : t));
  }
  function remove(id: string) {
    setTestimonials(prev => prev.filter(t => t.id !== id));
    toast('Removed');
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <div className="card">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">Approval rate</div>
          <div className="font-display text-[26px] font-semibold mt-1.5" style={{ color: 'var(--green)' }}>{approvalRate}%</div>
          <div className="text-[11.5px] text-[var(--faint)] mt-1">Across {decided} decided cases — the number worth putting on your website</div>
        </div>
        <div className="card">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">Success stories captured</div>
          <div className="font-display text-[26px] font-semibold mt-1.5">{testimonials.length}</div>
          <div className="text-[11.5px] text-[var(--faint)] mt-1">Out of {approved} approved cases</div>
        </div>
        <div className="card">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">Featured for marketing</div>
          <div className="font-display text-[26px] font-semibold mt-1.5" style={{ color: 'var(--gold)' }}>{testimonials.filter(t => t.featured).length}</div>
          <div className="text-[11.5px] text-[var(--faint)] mt-1">Ready to use on your site or socials</div>
        </div>
      </div>

      <div className="card mt-3.5" style={{ background: 'var(--navy-50)' }}>
        <div className="text-[12.5px]" style={{ color: 'var(--navy)' }}>
          Real testimonials and a visible approval rate are the single most-cited trust builder across the industry — more than any ad spend. Only capture a testimonial with the client&apos;s actual permission; mark it &quot;consent given&quot; before using it anywhere public.
        </div>
      </div>

      {withoutStory.length > 0 && (
        <>
          <SectionHead title="Approved cases without a success story yet" count={`${withoutStory.length} to follow up on`} />
          <div className="card p-0 overflow-auto">
            <table>
              <thead><tr><th>Client</th><th>Destination</th><th>Approved</th><th></th></tr></thead>
              <tbody>
                {withoutStory.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.destination} <span className="text-[var(--muted)] text-[11px]">{c.visaType}</span></td>
                    <td className="font-mono-ui text-xs">{fmtDate(c.createdAt)}</td>
                    <td><button className="btn btn-sm btn-primary" onClick={() => setAddFor(c)}>Add success story</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionHead title="Success stories" count={`${testimonials.length} captured`} />
      {!testimonials.length ? (
        <EmptyState title="No success stories yet" body="Once you have approved cases, capture a client's own words here — it's the strongest trust signal you have." />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
          {testimonials.map(t => (
            <div key={t.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-display font-semibold text-[15px]">{t.clientName}</div>
                  <div className="text-[var(--muted)] text-xs">{t.destination} · {t.visaType}</div>
                </div>
                {t.featured && <Stamp text="Approved" />}
              </div>
              <div className="text-[13px] leading-relaxed italic mb-2">&quot;{t.quote}&quot;</div>
              <div className="flex items-center justify-between">
                <div style={{ color: 'var(--gold)' }}>{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</div>
                {!t.consentGiven && <span className="text-[11px]" style={{ color: 'var(--red)' }}>No consent recorded</span>}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                <button className="btn btn-sm flex-1" onClick={() => toggleFeatured(t.id)}>{t.featured ? 'Unfeature' : 'Feature it'}</button>
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(t.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!addFor} onClose={() => setAddFor(null)}>
        {addFor && <TestimonialForm caseItem={addFor} onClose={() => setAddFor(null)} />}
      </Modal>
    </div>
  );
}

function TestimonialForm({ caseItem, onClose }: { caseItem: Case; onClose: () => void }) {
  const { setTestimonials } = useAppData();
  const toast = useToast();
  const [quote, setQuote] = useState(''); const [rating, setRating] = useState(5);
  const [consentGiven, setConsentGiven] = useState(false);

  function save() {
    if (!quote.trim()) { toast('Enter what the client said'); return; }
    if (!consentGiven) { toast('Confirm you have the client\'s permission first'); return; }
    setTestimonials(prev => [...prev, {
      id: genId('ts'), caseId: caseItem.id, clientName: caseItem.name, destination: caseItem.destination,
      visaType: caseItem.visaType, quote, rating, consentGiven, featured: false, createdAt: today(),
    }]);
    toast('Success story saved');
    onClose();
  }

  return (
    <>
      <ModalTitle>Add success story — {caseItem.name}</ModalTitle>
      <Field label="What the client said">
        <textarea rows={3} value={quote} onChange={e => setQuote(e.target.value)} placeholder="In their own words, if possible" />
      </Field>
      <Field label="Rating">
        <select value={rating} onChange={e => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-[13px] mb-3">
        <input type="checkbox" className="!w-auto" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} />
        The client has given permission to share this
      </label>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save success story</button>
      </ModalFoot>
    </>
  );
}
