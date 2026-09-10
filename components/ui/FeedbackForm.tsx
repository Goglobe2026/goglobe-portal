'use client';
import { useState } from 'react';

export function FeedbackForm({ referenceCode }: { referenceCode: string }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [moneyDemanded, setMoneyDemanded] = useState<boolean | null>(null);
  const [moneyDetails, setMoneyDetails] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    if (!rating) { setError('Please choose a star rating'); return; }
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseReferenceCode: referenceCode, rating, wouldRecommend: !!wouldRecommend,
          moneyDemanded: !!moneyDemanded, moneyDemandedDetails: moneyDetails, comment,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError('Something went wrong — please try again.');
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg px-4 py-4 text-center" style={{ background: 'var(--green-50)' }}>
        <div className="text-[13.5px] font-medium" style={{ color: 'var(--green)' }}>Thank you — your feedback has been recorded.</div>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-center text-[13px] font-medium px-4 py-2.5 rounded-lg"
        style={{ background: 'var(--navy-50)', color: 'var(--navy)' }}>
        Share feedback about your experience
      </button>
    );
  }

  return (
    <div className="rounded-lg px-4 py-4" style={{ background: '#F7F9FC', border: '1px solid var(--line)' }}>
      <div className="text-[13px] font-medium mb-2">How was your experience?</div>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} className="text-2xl leading-none" style={{ color: n <= rating ? 'var(--gold)' : 'var(--line)' }}>★</button>
        ))}
      </div>

      <div className="text-[13px] font-medium mb-1.5">Would you recommend GoGlobe Consultant?</div>
      <div className="flex gap-2 mb-3">
        <button onClick={() => setWouldRecommend(true)} className="btn btn-sm" style={wouldRecommend === true ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}}>Yes</button>
        <button onClick={() => setWouldRecommend(false)} className="btn btn-sm" style={wouldRecommend === false ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}}>No</button>
      </div>

      <div className="text-[13px] font-medium mb-1.5">Did anyone ask you for any personal payment, gift, or extra money beyond your official invoice?</div>
      <div className="flex gap-2 mb-2">
        <button onClick={() => setMoneyDemanded(false)} className="btn btn-sm" style={moneyDemanded === false ? { background: 'var(--green)', color: '#fff', borderColor: 'transparent' } : {}}>No</button>
        <button onClick={() => setMoneyDemanded(true)} className="btn btn-sm" style={moneyDemanded === true ? { background: 'var(--red)', color: '#fff', borderColor: 'transparent' } : {}}>Yes</button>
      </div>
      {moneyDemanded === true && (
        <textarea rows={2} value={moneyDetails} onChange={e => setMoneyDetails(e.target.value)}
          placeholder="Please tell us what happened — this goes directly and only to the company owner"
          className="w-full mb-3" />
      )}

      <div className="text-[13px] font-medium mb-1.5">Anything else you'd like to share? (optional)</div>
      <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comment" className="w-full mb-3" />

      {error && <div className="text-[12px] mb-2" style={{ color: 'var(--red)' }}>{error}</div>}
      <button onClick={submit} className="btn btn-primary w-full">Submit feedback</button>
    </div>
  );
}
