'use client';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, DESTINATIONS, visaTypesFor, CASE_STAGES, CASE_STATUSES, CASE_TYPES, genId, today, getDocTemplate, DEFAULT_RATES, fmtDate } from '@/lib/constants';
import { exportToCsv } from '@/lib/csv';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { Case, DocItem, Lead, Invoice } from '@/lib/types';
import { LOGO_FULL } from '@/lib/logo';

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
  const [search, setSearch] = useState('');
  const toast = useToast();

  const consultantName = (id: string) => team.find(t => t.id === id)?.name || 'Unassigned';
  function normalizeSearchPhone(p: string) { return (p || '').replace(/[^0-9]/g, '').replace(/^92/, '0'); }

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  function sortValue(c: Case, col: string): string | number {
    switch (col) {
      case 'name': return c.name.toLowerCase();
      case 'destination': return c.destination.toLowerCase();
      case 'consultant': return consultantName(c.consultant).toLowerCase();
      case 'caseStage': return CASE_STAGES.indexOf(c.caseStage as any);
      case 'status': return c.status.toLowerCase();
      case 'documents': return c.documents.filter(d => d.status === 'Verified').length;
      case 'charges': return overallCharge(c);
      default: return '';
    }
  }
  function toggleSort(col: string) {
    if (sortColumn === col) setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortColumn(col); setSortDirection('asc'); }
  }
  function sortArrow(col: string) {
    if (sortColumn !== col) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  const filtered = cases.filter(c => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, '');
    const nameMatch = c.name.toLowerCase().includes(q) || (c.referenceCode || '').toLowerCase().includes(q);
    const phoneMatch = qDigits.length > 0 && normalizeSearchPhone(c.phone).includes(normalizeSearchPhone(qDigits));
    return nameMatch || phoneMatch;
  }).sort((a, b) => {
    if (!sortColumn) return 0;
    const av = sortValue(a, sortColumn), bv = sortValue(b, sortColumn);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  // A converted lead should immediately open the "new case" form pre-filled.
  if (prefillFromLead && !showNew) { setShowNew(true); }

  function remove(id: string) { setCases(prev => prev.filter(c => c.id !== id)); toast('Case deleted'); }
  function exportCases() {
    const ok = exportToCsv('goglobe-cases', cases.map(c => ({
      Client: c.name, Phone: c.phone, Destination: c.destination, 'Visa Type': c.visaType, 'Case Type': c.caseType,
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

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, phone, or reference code…"
        className="mb-3.5"
        style={{ maxWidth: 360 }}
      />

      {!filtered.length ? (
        <EmptyState title={cases.length ? 'No cases match your search' : 'No cases yet'} body={cases.length ? 'Try a different name, phone number, or reference code.' : 'Convert a lead, or add a case directly.'} />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Client{sortArrow('name')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('destination')}>Destination{sortArrow('destination')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('consultant')}>Consultant{sortArrow('consultant')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('caseStage')}>Case stage{sortArrow('caseStage')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>Status{sortArrow('status')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('documents')}>Documents{sortArrow('documents')}</th>
              <th>Appt payment</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('charges')}>Overall charges{sortArrow('charges')}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {filtered.map(c => {
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
  const [caseType, setCaseType] = useState<string>(CASE_TYPES[0]);
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
      createdAt: today(), documents: getDocTemplate(dest, visaType), coverLetterChecked: false, managerApproved: false, caseType,
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
      <Field label="Case type (for your own records)"><select value={caseType} onChange={e => setCaseType(e.target.value)}>{CASE_TYPES.map(ct => <option key={ct}>{ct}</option>)}</select></Field>
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
  const { cases, setCases, team, referralAgents, setTransactions, logActivity, invoices, setInvoices } = useAppData();
  const toast = useToast();
  const c = cases.find(x => x.id === caseId)!;
  const [name, setName] = useState(c.name); const [phone, setPhone] = useState(c.phone);
  const [dest, setDest] = useState(c.destination); const [visaType, setVisaType] = useState(c.visaType);
  const [consultant, setConsultant] = useState(c.consultant); const [caseStage, setCaseStage] = useState(c.caseStage);
  const [caseType, setCaseType] = useState<string>(c.caseType || CASE_TYPES[0]);
  const [status, setStatus] = useState(c.status);
  const [discount, setDiscount] = useState(c.discount); const [discountReason, setDiscountReason] = useState(c.discountReason);
  const [newDocName, setNewDocName] = useState('');
  const [coverChecked, setCoverChecked] = useState(c.coverLetterChecked);
  const [costToExecute, setCostToExecute] = useState(c.costToExecute || 0);
  const [referralAgentId, setReferralAgentId] = useState(c.referralAgentId || '');
  const [referralCommissionPercent, setReferralCommissionPercent] = useState(c.referralCommissionPercent || 0);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const assignable = team.filter(t => ['Sales', 'Management'].includes(t.department) && (!t.employmentStatus || t.employmentStatus === 'Active'));
  const caseInvoices = invoices.filter(i => i.caseId === c.id).sort((a, b) => b.date.localeCompare(a.date));

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
    patchCase({ name, phone, destination: dest, visaType, consultant, caseStage, status, discount, discountReason, costToExecute, referralAgentId, referralCommissionPercent, caseType });
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
      <div className="grid grid-cols-3 gap-3">
        <Field label="Consultant"><select value={consultant} onChange={e => setConsultant(e.target.value)}>{assignable.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}</select></Field>
        <Field label="Case type (for your own records)"><select value={caseType} onChange={e => setCaseType(e.target.value)}>{CASE_TYPES.map(ct => <option key={ct}>{ct}</option>)}</select></Field>
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
        ? <button className="btn btn-sm mb-3" onClick={onPay}>Record a payment</button>
        : <div className="text-[11.5px] mb-3" style={{ color: 'var(--green)' }}>Fully paid.</div>}

      <div className="card mb-4.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">Invoices</div>
          <button className="btn btn-sm" onClick={() => setShowInvoiceForm(true)}>+ Generate invoice</button>
        </div>
        {caseInvoices.length === 0
          ? <div className="text-[12.5px] text-[var(--muted)]">No invoice generated yet for this case.</div>
          : <div className="flex flex-col gap-1.5">
              {caseInvoices.map(inv => (
                <button key={inv.id} className="btn btn-sm text-left" onClick={() => setViewInvoiceId(inv.id)}>
                  {inv.invoiceNumber} — {fmtDate(inv.date)} — {money(inv.totalAmount)}
                  {inv.advanceStatus === 'Paid' && inv.balanceStatus === 'Paid'
                    ? <span style={{ color: 'var(--green)' }}> · Fully paid</span>
                    : <span style={{ color: 'var(--red, #B5433A)' }}> · {inv.advanceStatus === 'Due' ? 'Advance due' : 'Balance pending'}</span>}
                </button>
              ))}
            </div>}
      </div>

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

      <Modal open={showInvoiceForm} onClose={() => setShowInvoiceForm(false)}>
        <InvoiceForm caseId={c.id} onClose={() => setShowInvoiceForm(false)} onCreated={id => { setShowInvoiceForm(false); setViewInvoiceId(id); }} />
      </Modal>
      <Modal open={!!viewInvoiceId} onClose={() => setViewInvoiceId(null)} wide>
        {viewInvoiceId && <InvoiceView invoiceId={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />}
      </Modal>
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

function InvoiceForm({ caseId, onClose, onCreated }: { caseId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { cases, setInvoices, invoices, logActivity } = useAppData();
  const toast = useToast();
  const c = cases.find(x => x.id === caseId)!;

  const [serviceDescription, setServiceDescription] = useState(`${c.destination} Visit Visa - File Preparation & Consultancy Services`);
  const [totalAmount, setTotalAmount] = useState(overallCharge(c));
  const [advancePercent, setAdvancePercent] = useState(50);
  const [clientCity, setClientCity] = useState('');

  const advanceAmount = Math.round(totalAmount * (advancePercent / 100));
  const balanceAmount = totalAmount - advanceAmount;

  function save() {
    const todayStr = today();
    const seq = String(invoices.filter(i => i.date === todayStr).length + 1).padStart(2, '0');
    const invoiceNumber = `GG-INV-${todayStr.replace(/-/g, '').slice(2)}-${seq}`;
    const newInvoice: Invoice = {
      id: genId('inv'), invoiceNumber, caseId: c.id, date: todayStr,
      clientName: c.name, clientPhone: c.phone, clientCity,
      visaType: c.visaType, destination: c.destination, serviceDescription,
      totalAmount, advancePercent, advanceAmount, advanceStatus: 'Due', advancePaidDate: '', advancePaymentMethod: '',
      balanceAmount, balanceStatus: 'Pending', balancePaidDate: '', balanceDueDate: '',
      clientAcknowledged: false, clientAcknowledgedDate: '',
    };
    setInvoices(prev => [...prev, newInvoice]);
    logActivity(`Invoice ${invoiceNumber} generated for ${c.name}`);
    toast('Invoice generated');
    onCreated(newInvoice.id);
  }

  return (
    <>
      <ModalTitle>Generate invoice — {c.name}</ModalTitle>
      <Field label="Service description"><input value={serviceDescription} onChange={e => setServiceDescription(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total consultancy fee (PKR)"><input type="number" value={totalAmount} onChange={e => setTotalAmount(Number(e.target.value))} /></Field>
        <Field label="Client city"><input value={clientCity} onChange={e => setClientCity(e.target.value)} placeholder="e.g. Rawalpindi" /></Field>
      </div>
      <Field label="Advance percentage">
        <select value={advancePercent} onChange={e => setAdvancePercent(Number(e.target.value))}>
          {[100, 75, 50, 40, 30, 25].map(p => <option key={p} value={p}>{p}%</option>)}
        </select>
      </Field>
      <div className="text-[12.5px] text-[var(--muted)] mb-3.5">
        Advance due now: <b>{money(advanceAmount)}</b> · Balance after advance: <b>{money(balanceAmount)}</b>
      </div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Generate invoice</button>
      </ModalFoot>
    </>
  );
}

function InvoiceView({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { invoices, setInvoices, logActivity } = useAppData();
  const toast = useToast();
  const inv = invoices.find(i => i.id === invoiceId)!;
  const [paymentMethod, setPaymentMethod] = useState('Online (Bank Transfer)');

  function update(patch: Partial<Invoice>) {
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, ...patch } : i));
  }
  function markAdvancePaid() {
    update({ advanceStatus: 'Paid', advancePaidDate: today(), advancePaymentMethod: paymentMethod });
    logActivity(`Advance payment recorded for invoice ${inv.invoiceNumber}`);
    toast('Advance marked as paid');
  }
  function markBalancePaid() {
    update({ balanceStatus: 'Paid', balancePaidDate: today() });
    logActivity(`Balance payment recorded for invoice ${inv.invoiceNumber}`);
    toast('Balance marked as paid');
  }
  function toggleAcknowledged() {
    const next = !inv.clientAcknowledged;
    update({ clientAcknowledged: next, clientAcknowledgedDate: next ? today() : '' });
    if (next) { logActivity(`Client acknowledged terms for invoice ${inv.invoiceNumber}`); toast('Marked as acknowledged by client'); }
  }

  const T: CSSProperties = { border: '1px solid #cfd8dc', padding: '6px 9px', fontSize: 11.5 };
  const TH: CSSProperties = { ...T, background: '#14213D', color: '#fff', fontWeight: 600 };

  return (
    <>
      <div className="no-print flex items-center justify-between mb-3.5">
        <ModalTitle>Invoice {inv.invoiceNumber}</ModalTitle>
        <div className="flex gap-2">
          {!inv.clientAcknowledged
            ? <button className="btn btn-sm" onClick={toggleAcknowledged}>Mark client acknowledged</button>
            : <span className="text-[12px]" style={{ color: 'var(--green)' }}>✓ Acknowledged {fmtDate(inv.clientAcknowledgedDate)}</span>}
          <button className="btn btn-sm btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      {inv.advanceStatus === 'Due' && (
        <div className="no-print card mb-3" style={{ background: 'var(--gold-50)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px]">Advance of {money(inv.advanceAmount)} not yet recorded as paid.</span>
            <div className="flex items-center gap-2">
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="!w-auto text-[12px]">
                <option>Online (Bank Transfer)</option><option>Cash</option><option>Easypaisa</option><option>JazzCash</option>
              </select>
              <button className="btn btn-sm" onClick={markAdvancePaid}>Mark advance paid</button>
            </div>
          </div>
        </div>
      )}
      {inv.advanceStatus === 'Paid' && inv.balanceStatus === 'Pending' && (
        <div className="no-print card mb-3" style={{ background: 'var(--gold-50)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px]">Balance of {money(inv.balanceAmount)} still pending.</span>
            <button className="btn btn-sm" onClick={markBalancePaid}>Mark balance paid</button>
          </div>
        </div>
      )}

      <div id="invoice-print-area" style={{ background: '#fff', color: '#1a1a1a', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: '#FBF0DD', border: '1px solid #E8C784', padding: '8px 12px', fontSize: 10.5, marginBottom: 10, lineHeight: 1.4 }}>
          <b>PAYMENT SECURITY ADVISORY:</b> All payments must be made only to the official bank account or other authorized payment account of GoGlobe Consultant.
          Any payment transferred to an employee's personal bank account, mobile wallet, or unauthorized third-party account without official written authorization
          is made at the client's own risk. GoGlobe Consultant shall not be responsible for any loss, misuse, dispute, non-receipt, recovery, reimbursement,
          compensation, or financial protection relating to such unauthorized payment.
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <img src={LOGO_FULL} style={{ height: 54 }} alt="GoGlobe Consultant" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#14213D' }}>INVOICE</div>
            <div style={{ fontSize: 11 }}><b>Invoice No:</b> {inv.invoiceNumber}</div>
            <div style={{ fontSize: 11 }}><b>Date:</b> {fmtDate(inv.date)}</div>
          </div>
        </div>
        <div style={{ height: 5, background: 'linear-gradient(90deg,#1FA463,#1F6E8C,#14213D)', marginBottom: 12 }} />

        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1, background: '#F2F8F5', padding: 10, fontSize: 11.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>BILL TO</div>
            <div>{inv.clientName}</div>
            <div>{inv.destination} Visit Visa Applicant</div>
            {inv.clientCity && <div>{inv.clientCity}</div>}
            <div>{inv.clientPhone}</div>
          </div>
          <div style={{ flex: 1, background: '#F2F8F5', padding: 10, fontSize: 11.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>FROM</div>
            <div>GoGlobe Consultant</div>
            <div>Office No. 303, 3rd Floor, Noor Mobile Mall,</div>
            <div>6th Road, Block D, Satellite Town, Rawalpindi.</div>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#14213D' }}>SERVICE DETAILS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={TH}>Description</th><th style={{ ...TH, textAlign: 'right', width: 130 }}>Amount (PKR)</th></tr></thead>
          <tbody><tr><td style={T}>{inv.serviceDescription}</td><td style={{ ...T, textAlign: 'right' }}>{inv.totalAmount.toLocaleString()}</td></tr></tbody>
        </table>

        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#14213D' }}>PAYMENT SUMMARY</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, textAlign: 'center' }}>
          <thead><tr><th style={TH}>Total Consultancy Fee</th><th style={TH}>Amount Received</th><th style={TH}>Outstanding Balance</th></tr></thead>
          <tbody><tr>
            <td style={{ ...T, fontWeight: 700 }}>PKR {inv.totalAmount.toLocaleString()}</td>
            <td style={{ ...T, fontWeight: 700, color: '#0B6E4F' }}>PKR {(inv.advanceStatus === 'Paid' ? inv.advanceAmount : 0) + (inv.balanceStatus === 'Paid' ? inv.balanceAmount : 0)}</td>
            <td style={{ ...T, fontWeight: 700, color: inv.balanceStatus === 'Paid' && inv.advanceStatus === 'Paid' ? '#0B6E4F' : '#B5433A' }}>
              PKR {(inv.totalAmount - ((inv.advanceStatus === 'Paid' ? inv.advanceAmount : 0) + (inv.balanceStatus === 'Paid' ? inv.balanceAmount : 0))).toLocaleString()}
              {inv.advanceStatus === 'Paid' && inv.balanceStatus === 'Paid' ? '' : ' - PENDING'}
            </td>
          </tr></tbody>
        </table>

        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#14213D' }}>PAYMENT TERMS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={TH}>Stage</th><th style={TH}>Amount</th><th style={TH}>Due</th><th style={TH}>Status</th></tr></thead>
          <tbody>
            <tr>
              <td style={T}>Advance ({inv.advancePercent}%) - payable against this invoice</td>
              <td style={T}>PKR {inv.advanceAmount.toLocaleString()}</td>
              <td style={T}>{inv.advanceStatus === 'Paid' ? fmtDate(inv.advancePaidDate) : 'On invoice'}</td>
              <td style={{ ...T, fontWeight: 700, color: inv.advanceStatus === 'Paid' ? '#0B6E4F' : '#B5433A' }}>{inv.advanceStatus === 'Paid' ? 'Received' : 'DUE NOW'}</td>
            </tr>
            <tr>
              <td style={T}>Balance ({100 - inv.advancePercent}%) - payable when prepared file is collected</td>
              <td style={T}>PKR {inv.balanceAmount.toLocaleString()}</td>
              <td style={T}>At file completion / before collection</td>
              <td style={{ ...T, fontWeight: 700, color: inv.balanceStatus === 'Paid' ? '#0B6E4F' : '#B5433A' }}>{inv.balanceStatus === 'Paid' ? 'Received' : 'Pending'}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#14213D' }}>PROFESSIONAL TERMS &amp; CONDITIONS OF SERVICE</div>
        <ol style={{ fontSize: 10, lineHeight: 1.5, paddingLeft: 16, marginBottom: 12 }}>
          <li style={{ marginBottom: 5 }}><b>ADVANCE / PAYMENTS – NON-REFUNDABLE.</b> The advance payment received against the total consultancy fee is non-refundable once the case has been started. The remaining balance becomes payable after the client has reviewed and verified the prepared file and must be cleared before file collection / handover. Consultancy and service charges cover professional case assessment, documentation, file preparation, appointment processing, and other services performed by GoGlobe Consultant and are not dependent upon the final visa decision.</li>
          <li style={{ marginBottom: 5 }}><b>VISA DECISION.</b> Visa approval or refusal is solely at the discretion of the relevant embassy, consulate, or visa authority. GoGlobe Consultant does not guarantee visa approval. In case of refusal, any re-application, appeal, or review requested by the client will be treated as a new service with a separately payable fee.</li>
          <li style={{ marginBottom: 5 }}><b>CLIENT DOCUMENT RESPONSIBILITY.</b> The client is responsible for providing complete, accurate, genuine, and verifiable information and documents. GoGlobe Consultant is not responsible for false, forged, altered, or misleading documents provided by the client.</li>
          <li style={{ marginBottom: 5 }}><b>COMPANY-PROVIDED / ATTACHED DOCUMENTS.</b> GoGlobe Consultant shall be responsible for documents prepared, provided, or attached by the company. If any such document is found to be wrong, false, fake, forged, invalid, or materially incorrect due to an error attributable to the company, GoGlobe Consultant shall correct, replace, or re-prepare it without additional consultancy charges.</li>
          <li style={{ marginBottom: 5 }}><b>APPOINTMENT ATTENDANCE &amp; CLIENT DELAYS.</b> The client is responsible for attending appointments, biometrics, interviews, and other required appearances on time. Any missed appointment, late document submission, or other delay caused by the client is the client's responsibility.</li>
          <li style={{ marginBottom: 5 }}><b>EMBASSY / THIRD-PARTY DELAYS.</b> GoGlobe Consultant is not responsible for delays caused by embassies, consulates, visa application centers, appointment availability, government authorities, courier services, or other third parties beyond the company's control.</li>
          <li style={{ marginBottom: 5 }}><b>PAYMENT STATUS.</b> The amount shown as received above has been received against the total consultancy fee. Any outstanding balance must be paid before the file is collected or handed over.</li>
          <li style={{ marginBottom: 5 }}><b>THIRD-PARTY CHARGES.</b> Embassy fees, biometric fees, courier charges, or other third-party costs are separate unless specifically included in writing.</li>
          <li style={{ marginBottom: 0 }}><b>AUTHORIZED COMPANY PAYMENT ACCOUNT.</b> All payments must be made only to the official bank account or other authorized payment account of GoGlobe Consultant. Any transfer to an employee's personal account, mobile wallet, representative, agent, or other third party without official written authorization is at the client's own risk.</li>
        </ol>

        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#14213D' }}>CLIENT ACKNOWLEDGEMENT</div>
        <div style={{ fontSize: 10.5, marginBottom: 10 }}>
          By signing below, the client confirms that the invoice details, payment terms, and terms &amp; conditions stated in this document have been read and understood.
        </div>
        <div style={{ display: 'flex', gap: 40, marginBottom: 10 }}>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 4, fontSize: 10.5 }}>CLIENT SIGNATURE</div>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 4, fontSize: 10.5 }}>
            AUTHORIZED SIGNATURE / COMPANY STAMP
            {inv.clientAcknowledged && <div style={{ color: '#0B6E4F', fontWeight: 700, marginTop: 2 }}>Acknowledged in system on {fmtDate(inv.clientAcknowledgedDate)}</div>}
          </div>
        </div>

        <div style={{ background: '#14213D', color: '#fff', padding: '8px 12px', fontSize: 10, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div><b>WhatsApp</b><br />0317-9911228 | 0327-9911228</div>
          <div><b>PTCL</b><br />051-6126833</div>
          <div><b>Email</b><br />info@goglobeconsultants.com</div>
          <div><b>Website</b><br />goglobeconsultants.com</div>
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 12 }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </>
  );
}
