'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, DESTINATIONS, visaTypesFor, CASE_STAGES, CASE_STATUSES, genId, today, getDocTemplate, DEFAULT_RATES, fmtDate } from '@/lib/constants';
import { exportToCsv } from '@/lib/csv';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { Case, DocItem, Lead } from '@/lib/types';

export function overallCharge(c: Case) { return Math.max(0, c.fee + c.apptFee + c.consultFee - c.discount); }
export function grossCharge(c: Case) { return c.fee + c.apptFee + c.consultFee; }
export function overallPaid(c: Case) { return c.paid + c.apptPaid + c.consultPaid; }

function getRate(rateCard: any[], destination: string, visaType: string) {
  return rateCard.find(r => r.destination === destination && r.visaType === visaType) || { consultFee: 3000, visaFee: 0, apptFee: 0 };
}

export function Cases({ prefillFromLead, clearPrefill }: { prefillFromLead: Lead | null; clearPrefill: () => void }) {
  const { cases, setCases, team, rateCard, setLeads } = useAppData();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const toast = useToast();

  const consultantName = (id: string) => team.find(t => t.id === id)?.name || 'Unassigned';

  // A converted lead should immediately open the "new case" form pre-filled.
  if (prefillFromLead && !showNew) { setShowNew(true); }

  function remove(id: string) { setCases(prev => prev.filter(c => c.id !== id)); toast('Case deleted'); }
  function exportCases() {
    const ok = exportToCsv('goglobe-cases', cases.map(c => ({
      Client: c.name, Phone: c.phone, Destination: c.destination, 'Visa Type': c.visaType,
      Consultant: consultantName(c.consultant), 'Case Stage': c.caseStage, Status: c.status,
      'Overall Charge': overallCharge(c), 'Overall Paid': overallPaid(c), Discount: c.discount,
      'Documents Verified': `${c.documents.filter(d => d.status === 'Verified').length}/${c.documents.length}`,
      Created: c.createdAt,
    })));
    if (!ok) toast('No cases yet to export');
  }

  return (
    <div>
      <SectionHead title="All cases" count={`${cases.length} total`} action={
        <div className="flex gap-2 ml-auto">
          <button className="btn" onClick={exportCases}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Add case</button>
        </div>
      } />
      {!cases.length ? (
        <EmptyState title="No cases yet" body="Convert a lead, or add a case directly." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Client</th><th>Destination</th><th>Consultant</th><th>Case stage</th><th>Status</th><th>Documents</th><th>Appt payment</th><th>Overall charges</th><th></th></tr></thead>
            <tbody>
              {cases.map(c => {
                const verified = c.documents.filter(d => d.status === 'Verified').length;
                return (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <button className="underline decoration-[var(--line)]" onClick={() => setOpenId(c.id)}>{c.name}</button>
                      <div className="font-mono-ui text-xs text-[var(--muted)]">{c.phone}</div>
                    </td>
                    <td>{c.destination} <span className="text-[var(--muted)] text-[11px]">{c.visaType}</span></td>
                    <td>{consultantName(c.consultant)}</td>
                    <td>
                      <select className="border-none bg-transparent font-medium p-0.5" value={c.caseStage}
                        onChange={e => setCases(prev => prev.map(x => x.id === c.id ? { ...x, caseStage: e.target.value as Case['caseStage'] } : x))}>
                        {CASE_STAGES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="border-none bg-transparent font-medium p-0.5" value={c.status}
                        onChange={e => setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: e.target.value as Case['status'] } : x))}>
                        {CASE_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><button className="btn btn-sm btn-ghost" onClick={() => setOpenId(c.id)}>{verified}/{c.documents.length} verified</button></td>
                    <td>{c.apptFee > 0 ? <Stamp text={c.apptPaid >= c.apptFee ? 'Approved' : 'Refused'} /> : <span className="text-[var(--muted)] font-mono-ui text-xs">n/a</span>}</td>
                    <td className="font-mono-ui text-xs">
                      {money(overallPaid(c))} / {money(overallCharge(c))}
                      {c.discount > 0 && <div style={{ color: 'var(--gold)' }}>−{money(c.discount)} discount</div>}
                    </td>
                    <td>
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        {c.caseStage === 'Manager Review' && <button className="btn btn-sm btn-primary" onClick={() => setOpenId(c.id)}>Review</button>}
                        {overallPaid(c) < overallCharge(c) && <button className="btn btn-sm" onClick={() => setPaymentFor(c.id)}>Payment</button>}
                        <button className="btn btn-sm btn-primary" onClick={() => setOpenId(c.id)}>Open file</button>
                        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(c.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!openId} onClose={() => setOpenId(null)} wide>
        {openId && <CaseFile caseId={openId} onClose={() => setOpenId(null)} onPay={() => { setPaymentFor(openId); setOpenId(null); }} />}
      </Modal>

      <Modal open={showNew} onClose={() => { setShowNew(false); clearPrefill(); }}>
        <NewCaseForm
          fromLead={prefillFromLead}
          onClose={() => { setShowNew(false); clearPrefill(); }}
          onCreated={(leadId) => { if (leadId) setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: 'Converted' } : l)); }}
        />
      </Modal>

      <Modal open={!!paymentFor} onClose={() => setPaymentFor(null)}>
        {paymentFor && <PaymentForm caseId={paymentFor} onClose={() => setPaymentFor(null)} />}
      </Modal>
    </div>
  );
}

function genCaseRefCode(existingCases: { referenceCode?: string }[]) {
  const year = new Date().getFullYear();
  const prefix = `GG-C-${year}`;
  const count = existingCases.filter(c => c.referenceCode && c.referenceCode.startsWith(prefix)).length + 1;
  return `${prefix}-${String(count).padStart(4, '0')}`;
}

function NewCaseForm({ fromLead, onClose, onCreated }: { fromLead: Lead | null; onClose: () => void; onCreated: (leadId: string | null) => void }) {
  const { cases, setCases, rateCard, team, logActivity } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(fromLead?.name || ''); const [phone, setPhone] = useState(fromLead?.phone || '');
  const [dest, setDest] = useState(fromLead?.destination || DESTINATIONS[0]);
  const [visaType, setVisaType] = useState(fromLead?.visaType || visaTypesFor(dest)[0]);
  const [consultant, setConsultant] = useState(fromLead?.assignedTo || team[0]?.id || '');
  const rate = getRate(rateCard, dest, visaType);
  const [fee, setFee] = useState(rate.visaFee); const [apptFee, setApptFee] = useState(rate.apptFee); const [consultFee, setConsultFee] = useState(rate.consultFee);
  const assignable = team.filter(t => ['Sales', 'Management'].includes(t.department) && (!t.employmentStatus || t.employmentStatus === 'Active'));

  function changeDest(d: string) {
    setDest(d);
    const vt = visaTypesFor(d)[0]; setVisaType(vt);
    const r = getRate(rateCard, d, vt); setFee(r.visaFee); setApptFee(r.apptFee); setConsultFee(r.consultFee);
  }
  function changeVisaType(vt: string) {
    setVisaType(vt);
    const r = getRate(rateCard, dest, vt); setFee(r.visaFee); setApptFee(r.apptFee); setConsultFee(r.consultFee);
  }

  function save() {
    if (!name.trim()) { toast('Enter a client name'); return; }
    setCases(prev => [...prev, {
      id: genId('cs'), referenceCode: genCaseRefCode(cases), name, phone, destination: dest, visaType, consultant, caseStage: 'Assessment', status: 'Active',
      fee, paid: 0, apptFee, apptPaid: 0, consultFee, consultPaid: 0, discount: 0, discountReason: '',
      costToExecute: 0, referralAgentId: '', referralCommissionPercent: 0, referralCommissionPaid: 0,
      createdAt: today(), documents: getDocTemplate(dest, visaType), coverLetterChecked: false, managerApproved: false,
    }]);
    logActivity(`${name} — new case created`);
    onCreated(fromLead?.id || null);
    toast('Case saved');
    onClose();
  }

  return (
    <>
      <ModalTitle>New case</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Client name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Destination"><select value={dest} onChange={e => changeDest(e.target.value)}>{DESTINATIONS.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Visa type"><select value={visaType} onChange={e => changeVisaType(e.target.value)}>{visaTypesFor(dest).map(v => <option key={v}>{v}</option>)}</select></Field>
      </div>
      <Field label="Consultant"><select value={consultant} onChange={e => setConsultant(e.target.value)}>{assignable.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}</select></Field>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-3">Fees auto-fill from Pricing by country — adjust per client if needed.</div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Consultation fee"><input type="number" value={consultFee} onChange={e => setConsultFee(Number(e.target.value))} /></Field>
        <Field label="Visa service fee"><input type="number" value={fee} onChange={e => setFee(Number(e.target.value))} /></Field>
        <Field label="Appointment fee"><input type="number" value={apptFee} onChange={e => setApptFee(Number(e.target.value))} /></Field>
      </div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save case</button>
      </ModalFoot>
    </>
  );
}

function CaseFile({ caseId, onClose, onPay }: { caseId: string; onClose: () => void; onPay: () => void }) {
  const { cases, setCases, team, referralAgents, setTransactions, logActivity } = useAppData();
  const toast = useToast();
  const c = cases.find(x => x.id === caseId)!;
  const [name, setName] = useState(c.name); const [phone, setPhone] = useState(c.phone);
  const [dest, setDest] = useState(c.destination); const [visaType, setVisaType] = useState(c.visaType);
  const [consultant, setConsultant] = useState(c.consultant); const [caseStage, setCaseStage] = useState(c.caseStage);
  const [status, setStatus] = useState(c.status);
  const [discount, setDiscount] = useState(c.discount); const [discountReason, setDiscountReason] = useState(c.discountReason);
  const [newDocName, setNewDocName] = useState('');
  const [coverChecked, setCoverChecked] = useState(c.coverLetterChecked);
  const [costToExecute, setCostToExecute] = useState(c.costToExecute || 0);
  const [referralAgentId, setReferralAgentId] = useState(c.referralAgentId || '');
  const [referralCommissionPercent, setReferralCommissionPercent] = useState(c.referralCommissionPercent || 0);
  const assignable = team.filter(t => ['Sales', 'Management'].includes(t.department) && (!t.employmentStatus || t.employmentStatus === 'Active'));

  const docs = c.documents;
  const verifiedCount = docs.filter(d => d.status === 'Verified').length;
  const allVerified = docs.length > 0 && docs.every(d => d.status === 'Verified');
  const netProfit = Math.max(0, overallCharge(c) - costToExecute);
  const commissionEarned = Math.round(netProfit * (referralCommissionPercent / 100));
  const commissionDue = Math.max(0, commissionEarned - (c.referralCommissionPaid || 0));

  function patchCase(patch: Partial<Case>) {
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, ...patch } : x));
  }
  function payReferralCommission() {
    const agent = referralAgents.find(a => a.id === referralAgentId);
    if (!agent || commissionDue <= 0) return;
    setTransactions(prev => [...prev, { id: genId('tx'), date: today(), type: 'Expense', category: 'Referral commission', party: agent.name, amount: commissionDue, note: `Commission on ${c.name}'s case` }]);
    patchCase({ referralCommissionPaid: (c.referralCommissionPaid || 0) + commissionDue });
    logActivity(`Referral commission paid — ${agent.name}, ${money(commissionDue)} (${c.name})`);
    toast('Commission paid');
  }
  function setDocStatus(docId: string, s: DocItem['status']) {
    patchCase({ documents: docs.map(d => d.id === docId ? { ...d, status: s } : d) });
  }
  function addDoc() {
    if (!newDocName.trim()) { toast('Enter a document name'); return; }
    patchCase({ documents: [...docs, { id: genId('dc'), name: newDocName, order: docs.length + 1, status: 'Pending' }] });
    setNewDocName('');
  }
  function forwardToManager() {
    patchCase({ caseStage: 'Manager Review' });
    logActivity(`${c.name} — file compiled, forwarded to manager`);
    toast('Forwarded to manager');
  }
  function approveManagerReview() {
    if (!coverChecked) { toast('Confirm the cover letter review first'); return; }
    patchCase({ coverLetterChecked: true, managerApproved: true, caseStage: 'Appointment Booking' });
    logActivity(`${c.name} — approved by manager`);
    toast('Approved — ready to book');
  }
  function saveDetails() {
    const oldDiscount = c.discount;
    patchCase({ name, phone, destination: dest, visaType, consultant, caseStage, status, discount, discountReason, costToExecute, referralAgentId, referralCommissionPercent });
    if (discount !== oldDiscount) logActivity(`${name} — discount set to ${money(discount)}${discountReason ? ' (' + discountReason + ')' : ''}`);
    else logActivity(`${name} — case file updated`);
    toast('Case saved');
    onClose();
  }

  const grossTotal = c.fee + c.apptFee + c.consultFee;
  const netTotal = Math.max(0, grossTotal - discount);

  return (
    <>
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-display text-[17px] m-0">{c.name}</h3>
        <Stamp text={c.status} />
      </div>
      <div className="text-[12.5px] text-[var(--muted)] mb-2">{c.destination} · {c.visaType} visa · Reference {c.referenceCode || '—'}</div>
      {c.referenceCode && (
        <div className="text-[12px] mb-4.5">
          <a href={`/case-status/${c.referenceCode}`} target="_blank" className="font-medium" style={{ color: 'var(--navy)' }}>View client status page ↗</a>
          <span className="text-[var(--faint)]"> — share this link or the reference code with the client so they can check progress themselves</span>
        </div>
      )}

      <SectionHead title="Case details" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Client name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Destination"><select value={dest} onChange={e => { setDest(e.target.value); setVisaType(visaTypesFor(e.target.value)[0]); }}>{DESTINATIONS.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Visa type"><select value={visaType} onChange={e => setVisaType(e.target.value)}>{visaTypesFor(dest).map(v => <option key={v}>{v}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Consultant"><select value={consultant} onChange={e => setConsultant(e.target.value)}>{assignable.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}</select></Field>
        <Field label="Case stage"><select value={caseStage} onChange={e => setCaseStage(e.target.value as Case['caseStage'])}>{CASE_STAGES.map(s => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Status"><select value={status} onChange={e => setStatus(e.target.value as Case['status'])}>{CASE_STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>

      <SectionHead title="Charges & payments" count={`Overall: ${money(overallPaid(c))} / ${money(overallCharge(c))}`} />
      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <MiniCharge label="Consultation" paid={c.consultPaid} total={c.consultFee} />
        <MiniCharge label="Visa service" paid={c.paid} total={c.fee} />
        <MiniCharge label="Appointment" paid={c.apptPaid} total={c.apptFee} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Discount (PKR)"><input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></Field>
        <Field label="Reason for discount"><input value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="e.g. Referral, loyal client" /></Field>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] mb-3.5">
        {discount > 0 ? `Standard price ${money(grossTotal)}, discounted by ${money(discount)} → client owes ${money(netTotal)}.` : 'No discount applied — client owes the full standard price.'}
      </div>
      {overallPaid(c) < overallCharge(c)
        ? <button className="btn btn-sm mb-4.5" onClick={onPay}>Record a payment</button>
        : <div className="text-[11.5px] mb-4.5" style={{ color: 'var(--green)' }}>Fully paid.</div>}

      <SectionHead title="Document checklist" count={`${verifiedCount}/${docs.length} verified — green is complete, red is missing`} />
      <div className="max-h-64 overflow-auto mb-2.5 border rounded-[10px] px-3 py-1" style={{ borderColor: 'var(--line)' }}>
        {docs.length ? docs.map(d => (
          <div key={d.id} className="flex items-center gap-2.5 py-2 border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
            <span className={`doc-dot ${d.status === 'Verified' ? 'verified' : d.status === 'Received' ? 'received' : 'pending'}`} />
            <span className="flex-1 text-[13px]" style={{ color: d.status === 'Verified' ? 'var(--green)' : d.status === 'Pending' ? 'var(--red)' : undefined, fontWeight: d.status === 'Verified' ? 500 : 400 }}>{d.name}</span>
            <select className="w-32" value={d.status} onChange={e => setDocStatus(d.id, e.target.value as DocItem['status'])}>
              <option value="Pending">Pending</option><option value="Received">Received</option><option value="Verified">Verified</option>
            </select>
          </div>
        )) : <div className="text-[var(--muted)] py-2.5">No checklist yet.</div>}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <Field label="Add document"><input value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="Document name" /></Field>
        <div className="mb-3 flex items-end"><button className="btn btn-sm" onClick={addDoc}>Add to checklist</button></div>
      </div>
      {allVerified && <button className="btn btn-sm mb-3.5" onClick={forwardToManager}>Compile file &amp; forward to manager</button>}

      {caseStage === 'Manager Review' && (
        <>
          <SectionHead title="Manager review" />
          <label className="flex items-center gap-2 text-[13px] mb-3.5">
            <input type="checkbox" className="!w-auto" checked={coverChecked} onChange={e => setCoverChecked(e.target.checked)} />
            Cover letter reviewed and approved
          </label>
          <button className="btn btn-sm mb-3.5" onClick={approveManagerReview}>Approve &amp; move to appointment booking</button>
        </>
      )}

      <SectionHead title="Direct client / referral agent" count="if an outside agent sourced this client directly" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Referral agent">
          <select value={referralAgentId} onChange={e => { setReferralAgentId(e.target.value); const a = referralAgents.find(x => x.id === e.target.value); if (a) setReferralCommissionPercent(a.defaultCommissionPercent); }}>
            <option value="">— None (staff-sourced lead) —</option>
            {referralAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Cost to execute (PKR)"><input type="number" value={costToExecute} onChange={e => setCostToExecute(Number(e.target.value))} placeholder="Embassy fees, processing costs, etc." /></Field>
      </div>
      {referralAgentId && (
        <>
          <Field label="Agent's commission (% of net profit)"><input type="number" value={referralCommissionPercent} onChange={e => setReferralCommissionPercent(Number(e.target.value))} /></Field>
          <div className="grid grid-cols-3 gap-3 mb-3.5">
            <div className="card p-2.5"><div className="metric-label text-[10.5px] uppercase text-[var(--muted)] font-semibold">Overall charges</div><div className="font-mono-ui text-[13px] mt-1">{money(overallCharge(c))}</div></div>
            <div className="card p-2.5"><div className="metric-label text-[10.5px] uppercase text-[var(--muted)] font-semibold">Net profit</div><div className="font-mono-ui text-[13px] mt-1">{money(netProfit)}</div></div>
            <div className="card p-2.5"><div className="metric-label text-[10.5px] uppercase text-[var(--muted)] font-semibold">Commission due</div><div className="font-mono-ui text-[13px] mt-1" style={{ color: commissionDue > 0 ? 'var(--gold)' : 'var(--green)' }}>{money(commissionDue)}</div></div>
          </div>
          {commissionDue > 0 && <button className="btn btn-sm mb-3.5" onClick={payReferralCommission}>Pay referral commission</button>}
        </>
      )}

      <ModalFoot>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={saveDetails}>Save changes</button>
      </ModalFoot>
    </>
  );
}

function MiniCharge({ label, paid, total }: { label: string; paid: number; total: number }) {
  return (
    <div className="card p-2.5">
      <div className="text-[10.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-mono-ui text-[13px] mt-1">{money(paid)} / {money(total)}</div>
    </div>
  );
}

function PaymentForm({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const { cases, setCases, transactions, setTransactions, logActivity } = useAppData();
  const toast = useToast();
  const c = cases.find(x => x.id === caseId)!;
  const caseBal = c.fee - c.paid; const apptBal = c.apptFee - c.apptPaid; const consultBal = c.consultFee - c.consultPaid;
  const options: { value: string; label: string }[] = [];
  if (consultBal > 0) options.push({ value: 'consult', label: `Consultation fee — balance ${money(consultBal)}` });
  if (caseBal > 0) options.push({ value: 'case', label: `Visa service fee — balance ${money(caseBal)}` });
  if (apptBal > 0) options.push({ value: 'appt', label: `Appointment fee — balance ${money(apptBal)}` });
  const [target, setTarget] = useState(options[0]?.value || 'case');
  const [amount, setAmount] = useState(0); const [note, setNote] = useState('');

  function save() {
    if (amount <= 0) { toast('Enter an amount'); return; }
    setCases(prev => prev.map(x => {
      if (x.id !== c.id) return x;
      if (target === 'appt') return { ...x, apptPaid: x.apptPaid + amount };
      if (target === 'consult') return { ...x, consultPaid: x.consultPaid + amount };
      return { ...x, paid: x.paid + amount };
    }));
    const labels: Record<string, string> = { case: 'visa fee', appt: 'appointment fee', consult: 'consultation fee' };
    setTransactions(prev => [...prev, {
      id: genId('tx'), date: today(), type: 'Income',
      category: target === 'appt' ? 'Appointment fee' : target === 'consult' ? 'Consultation fee' : 'Case payment',
      party: c.name, amount, note,
    }]);
    logActivity(`Payment received — ${c.name}, ${money(amount)} (${labels[target]})`);
    toast('Payment recorded');
    onClose();
  }

  return (
    <>
      <ModalTitle>Record payment — {c.name}</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3">Overall balance due: <b>{money(overallCharge(c) - overallPaid(c))}</b></div>
      <Field label="Applies to">
        <select value={target} onChange={e => setTarget(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Amount received (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
      <Field label="Note"><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Second instalment" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save payment</button>
      </ModalFoot>
    </>
  );
}
