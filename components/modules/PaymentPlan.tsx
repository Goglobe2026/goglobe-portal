'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import { caseCharge, casePaid } from '@/lib/finance';
import type { Case, PlanPart, PlanTrigger } from '@/lib/types';
import {
  computePlan, caseDue, presetPlan, planProblems, fitLastPart, STATUS_COLOR, TRIGGER_LABEL, PRESET_LABEL, type PresetKind, type PartView,
} from '@/lib/paymentPlan';

// ---------------------------------------------------------------------------
// Payment plan on a case file: "half now, half at the appointment".
// Money received on the file settles the oldest unpaid part first — shown
// here so nobody has to wonder where a payment went.
// ---------------------------------------------------------------------------

const TRIGGERS = Object.keys(TRIGGER_LABEL) as PlanTrigger[];
const PRESETS = Object.keys(PRESET_LABEL) as PresetKind[];

function Chip({ text, color }: { text: string; color: string }) {
  return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap" style={{ color, background: `${color}18` }}>{text}</span>;
}

function dueText(p: PartView) {
  if (p.status === 'Paid') return 'Paid';
  if (!p.due) return p.waitingFor;
  const src = p.dueFrom === 'appointment' ? ' (appointment date)' : p.dueFrom === 'opened' ? ' (day the file opened)' : '';
  return `${p.status === 'Overdue' ? 'Was due' : 'Due'} ${fmtDate(p.due)}${src}`;
}

export function PlanEditor({ c }: { c: Case }) {
  const { setCases, appointments, logActivity } = useAppData();
  const toast = useToast();
  const todayStr = today();
  const charge = caseCharge(c);
  const view = computePlan(c, appointments, todayStr);
  const [draft, setDraft] = useState<PlanPart[] | null>(null);
  const editing = draft !== null;

  function startFrom(kind: PresetKind) { setDraft(presetPlan(kind, charge, () => genId('pp'))); }
  function startBlank() {
    const half = Math.round(charge / 2);
    setDraft([{ id: genId('pp'), label: 'Advance', amount: half, trigger: 'now' }, { id: genId('pp'), label: 'Balance', amount: charge - half, trigger: 'date' }]);
  }
  function edit(i: number, patch: Partial<PlanPart>) { setDraft(d => d && d.map((p, k) => (k === i ? { ...p, ...patch } : p))); }
  const total = (draft || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const problems = draft ? planProblems(draft) : [];

  function save() {
    if (!draft) return;
    if (problems.length) { toast(problems[0]); return; }
    const clean = draft.map(p => ({ id: p.id, label: p.label.trim() || 'Part', amount: Math.round(Number(p.amount) || 0), trigger: p.trigger, ...(p.dueDate ? { dueDate: p.dueDate } : {}) }));
    setCases(prev => prev.map(x => (x.id === c.id ? { ...x, plan: clean } : x)));
    logActivity(`Payment plan set — ${c.name}: ${clean.map(p => `${p.label} ${money(p.amount)}`).join(' + ')}`);
    toast('Payment plan saved');
    setDraft(null);
  }
  function removePlan() {
    if (!window.confirm('Remove this payment plan? The file goes back to one balance. Money already received is not affected.')) return;
    setCases(prev => prev.map(x => { if (x.id !== c.id) return x; const { plan: _drop, ...rest } = x; void _drop; return rest as Case; }));
    logActivity(`Payment plan removed — ${c.name}`);
    toast('Plan removed');
    setDraft(null);
  }

  return (
    <div className="card mb-4" data-testid="plan-editor">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">Payment plan</div>
        {!editing && view && <button className="btn btn-sm" onClick={() => setDraft(c.plan!.map(p => ({ ...p })))}>Edit plan</button>}
      </div>

      {!editing && !view && (
        <>
          <div className="text-[12.5px] text-[var(--muted)] mb-2">
            No plan — the client owes one balance of <b>{money(Math.max(0, charge - casePaid(c)))}</b>. If they pay in parts (say half now, half at the appointment), set it up so each part is tracked on its own date.
          </div>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(k => <button key={k} className="btn btn-sm" data-testid={`preset-${k}`} onClick={() => startFrom(k)}>{PRESET_LABEL[k]}</button>)}
            <button className="btn btn-sm btn-ghost" onClick={startBlank}>Custom…</button>
          </div>
        </>
      )}

      {!editing && view && (
        <>
          <table className="w-full text-[12.5px]" data-testid="plan-table">
            <thead><tr className="text-left text-[11px] uppercase text-[var(--muted)]"><th className="py-1">Part</th><th>When</th><th className="text-right">Amount</th><th className="text-right">Received</th><th className="text-right">To go</th><th></th></tr></thead>
            <tbody>
              {view.parts.map(p => (
                <tr key={p.id} className="border-t" style={{ borderColor: 'var(--line)' }} data-testid={`part-${p.index}`} data-status={p.status}>
                  <td className="py-1.5"><b>{p.index + 1}. {p.label}</b>{!p.virtual && <div className="text-[11px] text-[var(--muted)]">{TRIGGER_LABEL[p.trigger]}</div>}</td>
                  <td className="text-[12px]">{dueText(p)}</td>
                  <td className="text-right font-mono-ui">{money(p.amount)}{p.amount !== p.planAmount && <div className="text-[10.5px] text-[var(--muted)]">plan said {money(p.planAmount)}</div>}</td>
                  <td className="text-right font-mono-ui">{money(p.paid)}</td>
                  <td className="text-right font-mono-ui">{money(p.remaining)}</td>
                  <td className="text-right"><Chip text={p.status} color={STATUS_COLOR[p.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[12px] mt-2.5" data-testid="plan-next">
            {view.next
              ? <>The <b>next payment</b> received on this file settles <b>{view.next.label}</b> first — {money(view.next.remaining)} to go{view.next.due ? <>, {view.next.status === 'Overdue' ? 'it was due' : 'due'} {fmtDate(view.next.due)}</> : null}. Anything beyond that carries into the part after it.</>
              : <span style={{ color: 'var(--green)' }}>Every part is paid.</span>}
          </div>
          {view.unscheduled > 0 && <div className="text-[12px] mt-1.5" style={{ color: '#8a5a12' }}>The plan covers {money(view.charge - view.unscheduled)} of the {money(view.charge)} fee — {money(view.unscheduled)} is not scheduled. Edit the plan to add it.</div>}
          {view.overplanned > 0 && <div className="text-[12px] mt-1.5" style={{ color: '#8a5a12' }}>The plan adds up to {money(view.overplanned)} more than the fee now is (a discount or fee change). The last part is counted at the smaller amount — edit the plan to tidy it.</div>}
        </>
      )}

      {editing && draft && (
        <div data-testid="plan-draft">
          <div className="text-[12px] text-[var(--muted)] mb-2">Each part has an amount and what makes it fall due. For “appointment” the date is taken from the client’s appointment in Appointments (matched by phone number) — or type the date yourself.</div>
          {draft.map((p, i) => (
            <div key={p.id} className="grid gap-2 mb-2 items-end" style={{ gridTemplateColumns: '1.2fr 1fr 1.6fr 1.1fr auto' }} data-testid={`draft-part-${i}`}>
              <label className="text-[11px] text-[var(--muted)] m-0">Name<input value={p.label} onChange={e => edit(i, { label: e.target.value })} data-testid={`draft-label-${i}`} /></label>
              <label className="text-[11px] text-[var(--muted)] m-0">Amount (PKR)<input type="number" value={p.amount} onChange={e => edit(i, { amount: Number(e.target.value) })} data-testid={`draft-amount-${i}`} /></label>
              <label className="text-[11px] text-[var(--muted)] m-0">Falls due<select value={p.trigger} onChange={e => edit(i, { trigger: e.target.value as PlanTrigger })} data-testid={`draft-trigger-${i}`}>{TRIGGERS.map(t => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}</select></label>
              <label className="text-[11px] text-[var(--muted)] m-0">{p.trigger === 'date' ? 'Date' : 'Date (if known)'}<input type="date" value={p.dueDate || ''} onChange={e => edit(i, { dueDate: e.target.value })} data-testid={`draft-date-${i}`} /></label>
              <button className="btn btn-sm btn-ghost btn-danger" disabled={draft.length <= 1} onClick={() => setDraft(d => d && d.filter((_, k) => k !== i))}>✕</button>
            </div>
          ))}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <button className="btn btn-sm" onClick={() => setDraft(d => d && [...d, { id: genId('pp'), label: `Part ${d.length + 1}`, amount: Math.max(0, charge - total), trigger: 'collection' }])}>+ Add a part</button>
            <span className="text-[12.5px]" data-testid="draft-total" style={{ color: total === charge ? 'var(--green)' : '#8a5a12' }}>
              Plan adds up to <b>{money(total)}</b> · fee is <b>{money(charge)}</b>
              {total !== charge && ` · ${total < charge ? `${money(charge - total)} not scheduled` : `${money(total - charge)} too much`}`}
            </span>
            {total !== charge && <button className="btn btn-sm btn-ghost" data-testid="draft-fit" onClick={() => setDraft(d => d && fitLastPart(d, charge))}>Make the last part fit</button>}
          </div>
          {problems.length > 0 && <div className="text-[12px] mb-2" style={{ color: 'var(--red)' }}>{problems.join(' · ')}</div>}
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" data-testid="plan-save" onClick={save}>Save plan</button>
            <button className="btn btn-sm" onClick={() => setDraft(null)}>Cancel</button>
            {c.plan && c.plan.length > 0 && <button className="btn btn-sm btn-ghost btn-danger ml-auto" onClick={removePlan}>Remove plan</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// One short line for the cases list: where this file's money stands.
export function PlanLine({ c }: { c: Case }) {
  const { appointments } = useAppData();
  if (!c.plan || !c.plan.length) return null;
  const cd = caseDue(c, appointments, today());
  if (!cd.next) return <div className="text-[10.5px] font-sans" style={{ color: 'var(--green)' }} data-testid="plan-line">Plan complete</div>;
  const n = cd.next;
  return (
    <div className="text-[10.5px] font-sans mt-0.5" data-testid="plan-line" style={{ color: STATUS_COLOR[n.status] }}>
      Next: {n.label}{n.due ? ` · ${n.status === 'Overdue' ? 'was due ' : ''}${fmtDate(n.due)}` : ' · no date yet'}
    </div>
  );
}

// In the "Record a payment" window: where this amount will land.
export function PaymentPreview({ c, amount }: { c: Case; amount: number }) {
  const { appointments } = useAppData();
  const todayStr = today();
  const before = computePlan(c, appointments, todayStr);
  if (!before) return null;
  const after = computePlan(c, appointments, todayStr, casePaid(c) + Math.max(0, amount));
  if (!after) return null;
  const lines = after.parts.map((p, i) => ({ p, got: p.paid - before.parts[i].paid })).filter(x => x.got > 0);
  return (
    <div className="card mb-3 text-[12.5px]" style={{ background: 'var(--navy-50)' }} data-testid="payment-preview">
      <div className="font-semibold mb-1">Payment plan — oldest part is settled first</div>
      {amount > 0 && lines.length > 0
        ? lines.map(({ p, got }) => (
            <div key={p.id}>{money(got)} → <b>{p.label}</b>: {p.remaining <= 0 ? <span style={{ color: 'var(--green)' }}>settled</span> : <>{money(p.remaining)} still to go</>}</div>
          ))
        : <div className="text-[var(--muted)]">{before.next ? <>Next part to settle: <b>{before.next.label}</b> — {money(before.next.remaining)}{before.next.due ? `, due ${fmtDate(before.next.due)}` : ''}.</> : 'Every part is paid.'}</div>}
      {amount > before.outstanding && <div style={{ color: '#8a5a12' }}>That is {money(amount - before.outstanding)} more than the file still owes.</div>}
    </div>
  );
}

