'use client';
// Money that leaves our account for a client's file — the appointment / embassy fee, courier…
// Each payout has a date. On that date it is added to Expenses by itself (in PKR); a payout
// made in another currency is converted with the rate typed here.
import { genId, money, fmtDate } from '@/lib/constants';
import type { CaseOutlay } from '@/lib/types';
import { toPkr, OUTLAY_CATEGORY } from '@/lib/caseBook';

export const OUTLAY_CURRENCIES = ['PKR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD'];
const CATEGORIES = [OUTLAY_CATEGORY, 'Other'];

export function blankOutlay(label: string, amount: number, date: string): CaseOutlay {
  return { id: genId('ol'), label, amount: Math.round(amount) || 0, date, category: OUTLAY_CATEGORY };
}

export function OutlayEditor({ outlays, onChange, apptFee, todayStr, apptLabel }: {
  outlays: CaseOutlay[]; onChange: (o: CaseOutlay[]) => void; apptFee: number; todayStr: string; apptLabel: string;
}) {
  const upd = (id: string, patch: Partial<CaseOutlay>) => onChange(outlays.map(o => (o.id === id ? { ...o, ...patch } : o)));
  // keep PKR in step with foreign amount × rate
  const updForeign = (o: CaseOutlay, patch: Partial<CaseOutlay>) => {
    const next = { ...o, ...patch };
    next.amount = toPkr(next.foreignAmount || 0, next.rate || 0);
    upd(o.id, next);
  };
  const setCurrency = (o: CaseOutlay, cur: string) => {
    if (cur === 'PKR') upd(o.id, { currency: undefined, foreignAmount: undefined, rate: undefined });
    else upd(o.id, { currency: cur, foreignAmount: o.foreignAmount || 0, rate: o.rate || 0 });
  };
  const hasAppt = outlays.some(o => /appointment|embassy/i.test(o.label));
  const inputStyle = { padding: '7px 9px', fontSize: 13.5 } as const;

  const statusOf = (o: CaseOutlay) => {
    if (o.posted) return { text: `Paid ${o.date ? fmtDate(o.date) : ''} — already in Expenses`, color: 'var(--green)' };
    if (!(o.amount > 0)) return { text: 'Enter the amount in PKR', color: 'var(--faint)' };
    if (!o.date) return { text: 'Add the date — until then it waits under Upcoming payouts as “no date”', color: '#8a5a12' };
    if (o.date <= todayStr) return { text: 'Counted in Expenses as soon as you save', color: 'var(--green)' };
    return { text: `Counted in Expenses automatically on ${fmtDate(o.date)}`, color: '#14213D' };
  };

  return (
    <div data-testid="outlay-editor">
      {outlays.length === 0 && (
        <div className="text-[12.5px] text-[var(--muted)] mb-2">
          No payouts yet. When we pay the embassy or appointment centre for this client, add it here with the date it leaves our account — it is deducted in PKR and counted in Expenses on that date.
        </div>
      )}
      {outlays.map(o => {
        const st = statusOf(o);
        if (o.posted) {
          return (
            <div key={o.id} data-testid="outlay-row" data-posted="1" className="flex items-center gap-3 text-[13px] py-1.5 border-b flex-wrap" style={{ borderColor: 'var(--line)' }}>
              <b>{o.label}</b><span>{money(o.amount)}</span>
              {o.currency && <span className="text-[var(--muted)]">({o.currency} {o.foreignAmount} @ {o.rate})</span>}
              <span style={{ color: st.color, fontWeight: 600 }}>{st.text}</span>
            </div>
          );
        }
        const foreign = !!o.currency && o.currency !== 'PKR';
        return (
          <div key={o.id} data-testid="outlay-row" className="mb-3 pb-2 border-b" style={{ borderColor: 'var(--line)' }}>
            <div className="grid gap-2 items-end" style={{ gridTemplateColumns: 'minmax(150px,2fr) 90px minmax(110px,1fr) 150px auto' }}>
              <div><label className="text-[11.5px]">What for</label>
                <input data-testid="outlay-label" style={inputStyle} value={o.label} onChange={e => upd(o.id, { label: e.target.value })} /></div>
              <div><label className="text-[11.5px]">Paid in</label>
                <select data-testid="outlay-currency" style={inputStyle} value={o.currency || 'PKR'} onChange={e => setCurrency(o, e.target.value)}>
                  {OUTLAY_CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select></div>
              <div><label className="text-[11.5px]">{foreign ? 'Amount deducted (PKR)' : 'Amount (PKR)'}</label>
                <input data-testid="outlay-amount" style={inputStyle} type="number" value={o.amount || ''} readOnly={foreign}
                  onChange={e => upd(o.id, { amount: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></div>
              <div><label className="text-[11.5px]">Leaves our account on</label>
                <input data-testid="outlay-date" style={inputStyle} type="date" value={o.date} onChange={e => upd(o.id, { date: e.target.value })} /></div>
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => onChange(outlays.filter(x => x.id !== o.id))}>Remove</button>
            </div>
            {foreign && (
              <div className="grid gap-2 items-end mt-2" style={{ gridTemplateColumns: '140px 160px 1fr' }}>
                <div><label className="text-[11.5px]">Amount in {o.currency}</label>
                  <input data-testid="outlay-foreign" style={inputStyle} type="number" step="0.01" value={o.foreignAmount || ''} onChange={e => updForeign(o, { foreignAmount: Math.max(0, Number(e.target.value) || 0) })} /></div>
                <div><label className="text-[11.5px]">PKR per 1 {o.currency}</label>
                  <input data-testid="outlay-rate" style={inputStyle} type="number" step="0.01" value={o.rate || ''} onChange={e => updForeign(o, { rate: Math.max(0, Number(e.target.value) || 0) })} /></div>
                <div className="text-[12px] text-[var(--muted)] pb-2">{o.foreignAmount && o.rate ? `${o.currency} ${o.foreignAmount} × ${o.rate} = ${money(o.amount)}` : 'Type the amount and the rate the bank gave — PKR is worked out for you.'}</div>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <select aria-label="Expense category" style={{ ...inputStyle, width: 160 }} value={o.category || OUTLAY_CATEGORY} onChange={e => upd(o.id, { category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <span data-testid="outlay-status" className="text-[12px]" style={{ color: st.color }}>{st.text}</span>
            </div>
          </div>
        );
      })}
      <div className="flex gap-2 flex-wrap">
        {apptFee > 0 && !hasAppt && (
          <button type="button" data-testid="outlay-add-appt" className="btn btn-sm" onClick={() => onChange([...outlays, blankOutlay(apptLabel, apptFee, '')])}>
            + Appointment fee we pay for this client ({money(apptFee)})
          </button>
        )}
        <button type="button" data-testid="outlay-add" className="btn btn-sm btn-ghost" onClick={() => onChange([...outlays, blankOutlay('', 0, '')])}>+ Add another payout</button>
      </div>
    </div>
  );
}
