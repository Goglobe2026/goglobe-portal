'use client';
import { useState } from 'react';
import { printSheet } from '@/lib/printSheet';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, DESTINATIONS, visaTypesFor, CASE_STAGES, CASE_STATUSES, CASE_TYPES, genId, today, getDocTemplate, DEFAULT_RATES, fmtDate } from '@/lib/constants';
import { exportToCsv } from '@/lib/csv';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { Case, DocItem, Lead, Invoice, FamilyMember, CaseBonus } from '@/lib/types';
import { closerOf, closedOn, applicantsOf, isFamilyCase, monthLabel } from '@/lib/finance';
import { FamilyEditor, ClosingEditor, BonusEditor, blankMember } from './CaseParts';
import { LOGO_FULL } from '@/lib/logo';
import { latestQc } from '@/lib/qc';
import { QcCheckForm } from './QualityControl';

export function overallCharge(c: Case) { return Math.max(0, c.fee + c.apptFee + c.consultFee - c.discount); }
export function grossCharge(c: Case) { return c.fee + c.apptFee + c.consultFee; }
// Spreads a payment across consultation, visa and appointment fee balances
// (the same order the payment form offers) and says how much actually fit.
export function allocateCasePayment(c: Case, amount: number) {
  let left = amount;
  const patch = { paid: c.paid, apptPaid: c.apptPaid, consultPaid: c.consultPaid };
  const parts: { category: string; amount: number }[] = [];
  const take = (bal: number, key: 'paid' | 'apptPaid' | 'consultPaid', category: string) => {
    const t = Math.min(left, Math.max(0, bal));
    if (t > 0) { patch[key] += t; left -= t; parts.push({ category, amount: t }); }
  };
  take(c.consultFee - c.consultPaid, 'consultPaid', 'Consultation fee');
  take(c.fee - c.paid, 'paid', 'Case payment');
  take(c.apptFee - c.apptPaid, 'apptPaid', 'Appointment fee');
  return { patch, parts, applied: amount - left };
}

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
      case 'closedBy': return closedOn(c);
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
    const nameMatch = c.name.toLowerCase().includes(q) || (c.referenceCode || '').toLowerCase().includes(q)
      || (c.familyMembers || []).some(m => m.name.toLowerCase().includes(q) || (m.passportNo || '').toLowerCase().includes(q));
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
      Applicants: applicantsOf(c), 'Family Members': (c.familyMembers || []).map(m => `${m.name} (${m.relation})`).join('; '),
      Consultant: consultantName(c.consultant), 'Closed By': closerOf(c) ? consultantName(closerOf(c)) : 'Not closed yet', 'Closing Date': closedOn(c),
      'Case Stage': c.caseStage, Status: c.status,
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
        placeholder="Search by name (family members too), phone, or reference code…"
        className="mb-3.5"
        style={{ maxWidth: 360 }}
      />

      {!filtered.length ? (
        <EmptyState title={cases.length ? 'No cases match your search' : 'No cases yet'} body={cases.length ? 'Try a different name, phone number, or reference code.' : 'Convert a lead, or add a case directly.'} />
      ) : (
        <div className="card p-0 overflow-auto">
          <table className="cases-table">
            <thead><tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Client{sortArrow('name')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('destination')}>Destination{sortArrow('destination')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('consultant')}>Consultant{sortArrow('consultant')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('closedBy')}>Closed by{sortArrow('closedBy')}</th>
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
                      <button className="underline decoration-[var(--line)] text-left" onClick={() => setOpenId(c.id)}>{c.name}</button>
                      {isFamilyCase(c) && <div className="mt-0.5"><span title={`Family file — ${applicantsOf(c)} applicants`} className="text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'var(--gold-50)', border: '1px solid #E8C784', color: '#8a5a12' }}>FAMILY · {applicantsOf(c)}</span></div>}
                      <div className="font-mono-ui text-xs text-[var(--muted)]">{c.phone}</div>
                    </td>
                    <td className="whitespace-nowrap">{c.destination}<div className="text-[var(--muted)] text-[11px]">{c.visaType}</div></td>
                    <td className="whitespace-nowrap">{consultantName(c.consultant)}</td>
                    <td className="text-[12.5px] whitespace-nowrap">{closerOf(c) ? <>{consultantName(closerOf(c))}<div className="font-mono-ui text-[10.5px] text-[var(--muted)]">{fmtDate(closedOn(c))}</div></> : <span className="text-[var(--faint)]">Not closed</span>}</td>
                    <td>
                      <select className="in-table-select border-none bg-transparent font-medium" value={c.caseStage}
                        onChange={e => setCases(prev => prev.map(x => x.id === c.id ? { ...x, caseStage: e.target.value as Case['caseStage'] } : x))}>
                        {CASE_STAGES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="in-table-select narrow border-none bg-transparent font-medium" value={c.status}
                        onChange={e => setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: e.target.value as Case['status'] } : x))}>
                        {CASE_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><button className="btn btn-sm btn-ghost !px-1.5" title="Documents verified" onClick={() => setOpenId(c.id)}>{verified}/{c.documents.length}</button></td>
                    <td>{c.apptFee > 0 ? <Stamp text={c.apptPaid >= c.apptFee ? 'Approved' : 'Refused'} /> : <span className="text-[var(--muted)] font-mono-ui text-xs">n/a</span>}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">
                      <div className="font-semibold">{money(overallPaid(c))}</div>
                      <div className="text-[var(--muted)] text-[11px]">of {money(overallCharge(c))}</div>
                      {overallPaid(c) < overallCharge(c) && <button className="btn btn-sm !py-0.5 mt-1 font-sans" onClick={() => setPaymentFor(c.id)}>Payment</button>}
                      {c.discount > 0 && <div style={{ color: 'var(--gold)' }}>−{money(c.discount)} discount</div>}
                    </td>
                    <td>
                      <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          {c.caseStage === 'Manager Review' && <button className="btn btn-sm btn-primary" onClick={() => setOpenId(c.id)}>Review</button>}
                          <button className="btn btn-sm btn-primary" onClick={() => setOpenId(c.id)}>Open file</button>
                        </div>
                        <button className="btn btn-sm btn-ghost btn-danger !py-0.5" onClick={() => remove(c.id)}>Delete</button>
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

      <Modal open={showNew} onClose={() => { setShowNew(false); clearPrefill(); }} wide>
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
  const { cases, setCases, setTransactions, rateCard, team, logActivity } = useAppData();
  const toast = useToast();
  const todayStr = today();
  const [mode, setMode] = useState<'single' | 'family'>('single');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [memberChecklists, setMemberChecklists] = useState(false);
  const [name, setName] = useState(fromLead?.name || ''); const [phone, setPhone] = useState(fromLead?.phone || '');
  const [dest, setDest] = useState(fromLead?.destination || DESTINATIONS[0]);
  const [visaType, setVisaType] = useState(fromLead?.visaType || visaTypesFor(dest)[0]);
  const [consultant, setConsultant] = useState(fromLead?.assignedTo || team[0]?.id || '');
  const [caseType, setCaseType] = useState<string>(CASE_TYPES[0]);
  const [closedBy, setClosedBy] = useState(fromLead?.assignedTo || team[0]?.id || '');
  const [closedDate, setClosedDate] = useState(todayStr);
  const [closerTouched, setCloserTouched] = useState(false);
  const [bonuses, setBonuses] = useState<CaseBonus[]>([]);
  const [receivedNow, setReceivedNow] = useState(0);
  const [receivedOn, setReceivedOn] = useState(todayStr);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const rate = getRate(rateCard, dest, visaType);
  // Pricing is per applicant. A family file multiplies it by the number of
  // people; the consultation fee is charged once per family unless ticked.
  const [consultPerPerson, setConsultPerPerson] = useState(false);
  const [override, setOverride] = useState<{ consult?: number; fee?: number; appt?: number }>({});
  const named = members.filter(m => m.name.trim());
  const count = mode === 'family' ? 1 + named.length : 1;
  const consultFee = override.consult ?? rate.consultFee * (consultPerPerson ? count : 1);
  const fee = override.fee ?? rate.visaFee * count;
  const apptFee = override.appt ?? rate.apptFee * count;
  const total = consultFee + fee + apptFee;
  const assignable = team.filter(t => ['Sales', 'Management'].includes(t.department) && (!t.employmentStatus || t.employmentStatus === 'Active'));
  const activeStaff = team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave');

  function changeDest(d: string) { setDest(d); setVisaType(visaTypesFor(d)[0]); setOverride({}); }
  function changeVisaType(vt: string) { setVisaType(vt); setOverride({}); }
  function changeConsultant(id: string) { setConsultant(id); if (!closerTouched) setClosedBy(id); }
  function switchMode(m: 'single' | 'family') {
    setMode(m);
    if (m === 'family') {
      if (!members.length) setMembers([blankMember(), blankMember()]);
      if (caseType === CASE_TYPES[0]) setCaseType('Family/Spouse Visa Consultancy');
    }
  }

  function save() {
    if (!name.trim()) { toast(mode === 'family' ? 'Enter the head of family’s name' : 'Enter a client name'); return; }
    if (mode === 'family' && !named.length) { toast('Add at least one family member, or switch to a single client'); return; }
    if (closedBy && !closedDate) { toast('Enter the closing date'); return; }
    const familyMembers = mode === 'family' ? named.map(m => ({ ...m, name: m.name.trim() })) : undefined;
    let documents = getDocTemplate(dest, visaType);
    if (familyMembers && memberChecklists) {
      familyMembers.forEach(m => { documents = [...documents, ...getDocTemplate(dest, visaType).map(d => ({ ...d, name: `${m.name} — ${d.name}` }))]; });
      documents = documents.map((d, i) => ({ ...d, order: i + 1 }));
    }
    const newCase: Case = {
      id: genId('cs'), referenceCode: genCaseRefCode(cases), name: name.trim(), phone, destination: dest, visaType, consultant, caseStage: 'Assessment', status: 'Active',
      fee, paid: 0, apptFee, apptPaid: 0, consultFee, consultPaid: 0, discount: 0, discountReason: '',
      costToExecute: 0, referralAgentId: '', referralCommissionPercent: 0, referralCommissionPaid: 0,
      createdAt: closedBy && closedDate && closedDate < todayStr ? closedDate : todayStr,
      documents, coverLetterChecked: false, managerApproved: false, caseType,
      closedBy, closedDate: closedBy ? closedDate : '',
    };
    if (familyMembers) newCase.familyMembers = familyMembers;
    const goodBonuses = bonuses.filter(b => b.staffId && b.amount > 0);
    if (goodBonuses.length) newCase.caseBonuses = goodBonuses;
    // Money already received (an advance, or a whole old case being entered now).
    if (receivedNow > 0) {
      const { patch, parts } = allocateCasePayment(newCase, receivedNow);
      Object.assign(newCase, patch);
      setTransactions(prev => [...prev, ...parts.map(p => ({
        id: genId('tx'), date: receivedOn || todayStr, type: 'Income' as const, category: p.category, party: newCase.name,
        amount: p.amount, note: 'Received at case entry', caseId: newCase.id,
      }))]);
    }
    setCases(prev => [...prev, newCase]);
    logActivity(`${newCase.name} — new ${familyMembers ? `family case (${count} applicants)` : 'case'} created`);
    onCreated(fromLead?.id || null);
    toast(familyMembers ? `Family file saved — ${count} applicants` : 'Case saved');
    onClose();
  }

  const calc = (per: number, n: number) => n > 1 ? `${money(per)} × ${n}` : '';
  const tab = (m: 'single' | 'family', label: string, sub: string) => (
    <button type="button" onClick={() => switchMode(m)} className="flex-1 text-left rounded-[12px] px-4 py-2.5"
      style={{ border: `2px solid ${mode === m ? '#14213D' : 'var(--line)'}`, background: mode === m ? 'var(--gold-50)' : '#fff' }}>
      <div style={{ fontWeight: 700, fontSize: 14.5, color: '#14213D' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>
    </button>
  );

  return (
    <>
      <ModalTitle>New case</ModalTitle>
      <div className="flex gap-3 mb-4">
        {tab('single', 'Single client', 'One person, one file')}
        {tab('family', 'Family / group file', 'Father, mother, kids… all on one file and one invoice')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={mode === 'family' ? 'Head of family (main applicant)' : 'Client name'}><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      </div>

      {mode === 'family' && (
        <div className="mb-3">
          <label>Other applicants on this file <span className="font-normal text-[var(--muted)]">— {count} applicant{count === 1 ? '' : 's'} in total</span></label>
          <FamilyEditor members={members} onChange={setMembers} />
          <label className="flex items-center gap-2 text-[12.5px] mt-2.5">
            <input type="checkbox" className="!w-auto" checked={memberChecklists} onChange={e => setMemberChecklists(e.target.checked)} />
            Also create a document checklist for every family member
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Destination"><select value={dest} onChange={e => changeDest(e.target.value)}>{DESTINATIONS.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Visa type"><select value={visaType} onChange={e => changeVisaType(e.target.value)}>{visaTypesFor(dest).map(v => <option key={v}>{v}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Case type (for your own records)"><select value={caseType} onChange={e => setCaseType(e.target.value)}>{CASE_TYPES.map(ct => <option key={ct}>{ct}</option>)}</select></Field>
        <Field label="Consultant handling the file"><select value={consultant} onChange={e => changeConsultant(e.target.value)}>{assignable.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}</select></Field>
      </div>

      <SectionHead title="Fees" count={mode === 'family' ? `Pricing is per person — ${count} applicants` : 'auto-filled from Pricing'} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Consultation fee"><input type="number" value={consultFee} onChange={e => setOverride(o => ({ ...o, consult: Number(e.target.value) }))} />
          {mode === 'family' && <div className="text-[11.5px] text-[var(--faint)] mt-1">{consultPerPerson ? calc(rate.consultFee, count) : 'charged once for the family'}</div>}</Field>
        <Field label="Visa service fee"><input type="number" value={fee} onChange={e => setOverride(o => ({ ...o, fee: Number(e.target.value) }))} />
          {mode === 'family' && <div className="text-[11.5px] text-[var(--faint)] mt-1">{calc(rate.visaFee, count)}</div>}</Field>
        <Field label="Appointment fee"><input type="number" value={apptFee} onChange={e => setOverride(o => ({ ...o, appt: Number(e.target.value) }))} />
          {mode === 'family' && <div className="text-[11.5px] text-[var(--faint)] mt-1">{calc(rate.apptFee, count)}</div>}</Field>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2 text-[12.5px] mb-3.5">
        <span><b>Total for this file: {money(total)}</b>{Object.values(override).some(v => v !== undefined) && <button type="button" className="underline ml-2 text-[var(--muted)]" onClick={() => setOverride({})}>reset to pricing</button>}</span>
        {mode === 'family' && <label className="flex items-center gap-2"><input type="checkbox" className="!w-auto" checked={consultPerPerson} onChange={e => { setConsultPerPerson(e.target.checked); setOverride(o => ({ ...o, consult: undefined })); }} />Charge consultation fee for every applicant</label>}
      </div>

      <SectionHead title="Closing" count="who won this client — counts in their performance and payroll" />
      <ClosingEditor closedBy={closedBy} closedDate={closedDate} staff={activeStaff}
        onChange={p => {
          if (p.closedBy !== undefined) { setClosedBy(p.closedBy); setCloserTouched(true); }
          if (p.closedDate !== undefined) { setClosedDate(p.closedDate); if (!receivedTouched) setReceivedOn(p.closedDate); }
        }} />

      <SectionHead title="Bonus on this case" count="optional" />
      <BonusEditor bonuses={bonuses} staff={activeStaff} defaultMonth={(closedDate || todayStr).slice(0, 7)} onChange={setBonuses} />

      <SectionHead title="Money received so far" count="optional — use when entering an older case" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount already received (PKR)"><input type="number" value={receivedNow || ''} onChange={e => setReceivedNow(Math.max(0, Number(e.target.value) || 0))} /></Field>
        <Field label="Received on"><input type="date" value={receivedOn} max={todayStr} onChange={e => { setReceivedOn(e.target.value); setReceivedTouched(true); }} /></Field>
      </div>
      {receivedNow > 0 && <div className="text-[12px] text-[var(--muted)] -mt-1 mb-3">Recorded in Accounts on that date, so the right month’s closing picks it up. Balance still to collect: <b>{money(Math.max(0, total - receivedNow))}</b></div>}

      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{mode === 'family' ? `Save family file (${count})` : 'Save case'}</button>
      </ModalFoot>
    </>
  );
}

function CaseFile({ caseId, onClose, onPay }: { caseId: string; onClose: () => void; onPay: () => void }) {
  const { cases, setCases, team, referralAgents, setTransactions, logActivity, invoices, setInvoices, qcChecks } = useAppData();
  const toast = useToast();
  const c = cases.find(x => x.id === caseId)!;
  const [showQc, setShowQc] = useState(false);
  const lastQc = latestQc(qcChecks, c.id);
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
  const [members, setMembers] = useState<FamilyMember[]>(c.familyMembers || []);
  const [closedBy, setClosedBy] = useState(closerOf(c));
  const [closedDate, setClosedDate] = useState(c.closedDate || (closerOf(c) ? c.createdAt : ''));
  const [bonuses, setBonuses] = useState<CaseBonus[]>(c.caseBonuses || []);
  const [feeConsult, setFeeConsult] = useState(c.consultFee); const [feeVisa, setFeeVisa] = useState(c.fee); const [feeAppt, setFeeAppt] = useState(c.apptFee);
  const assignable = team.filter(t => ['Sales', 'Management'].includes(t.department) && (!t.employmentStatus || t.employmentStatus === 'Active'));
  const closerStaff = team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave' || t.id === closerOf(c) || bonuses.some(b => b.staffId === t.id));
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
    if (lastQc?.result !== 'Passed') { toast('Do the quality check first — the file must pass it before approval'); return; }
    if (!coverChecked) { toast('Confirm the cover letter review first'); return; }
    patchCase({ coverLetterChecked: true, managerApproved: true, caseStage: 'Appointment Booking' });
    logActivity(`${c.name} — approved by manager`);
    toast('Approved — ready to book');
  }
  function addMemberChecklist(m: FamilyMember) {
    if (!m.name.trim()) { toast('Enter the member’s name first'); return; }
    if (docs.some(d => d.name.startsWith(`${m.name} — `))) { toast(`${m.name} already has a checklist`); return; }
    const tpl = getDocTemplate(dest, visaType).map((d, i) => ({ ...d, name: `${m.name} — ${d.name}`, order: docs.length + i + 1 }));
    patchCase({ documents: [...docs, ...tpl] });
    toast(`Checklist added for ${m.name}`);
  }
  function saveDetails() {
    const oldDiscount = c.discount;
    const cleanMembers = members.filter(m => m.name.trim()).map(m => ({ ...m, name: m.name.trim() }));
    // A bonus already paid through payroll must stay paid, even if this screen was opened before that.
    const liveBonuses = c.caseBonuses || [];
    const cleanBonuses = bonuses.map(b => liveBonuses.find(x => x.id === b.id && x.paid) || b).filter(b => b.staffId && b.amount > 0);
    if (closedBy && !closedDate) { toast('Enter the closing date'); return; }
    patchCase({
      name, phone, destination: dest, visaType, consultant, caseStage, status, discount, discountReason, costToExecute, referralAgentId, referralCommissionPercent, caseType,
      consultFee: feeConsult, fee: feeVisa, apptFee: feeAppt,
      familyMembers: cleanMembers.length ? cleanMembers : undefined,
      closedBy, closedDate: closedBy ? closedDate : '',
      caseBonuses: cleanBonuses.length ? cleanBonuses : undefined,
    });
    if (discount !== oldDiscount) logActivity(`${name} — discount set to ${money(discount)}${discountReason ? ' (' + discountReason + ')' : ''}`);
    else logActivity(`${name} — case file updated`);
    toast('Case saved');
    onClose();
  }

  const grossTotal = feeVisa + feeAppt + feeConsult;
  const netTotal = Math.max(0, grossTotal - discount);

  return (
    <>
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-display text-[17px] m-0">{c.name}{isFamilyCase(c) && <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full align-middle" style={{ background: 'var(--gold-50)', border: '1px solid #E8C784', color: '#8a5a12' }}>FAMILY FILE · {applicantsOf(c)} APPLICANTS</span>}</h3>
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

      <SectionHead title={members.length ? `Family file — ${members.length + 1} applicants` : 'Family file'} count="head of family is the client name above" />
      {!members.length && <div className="text-[12.5px] text-[var(--muted)] mb-2">This is a single-client file. If more people travel on it — spouse, parents, children — add them here and it becomes a family file with one fee, one ledger and one invoice. Remember to update the fees below.</div>}
      <div className="mb-3.5">
        <FamilyEditor members={members} onChange={setMembers}
          extraAction={m => <button type="button" className="btn btn-sm btn-ghost mr-1" onClick={() => addMemberChecklist(m)}>+ Checklist</button>} />
      </div>

      <SectionHead title="Closing & bonus" count="who won this client, and any bonus on this case" />
      <ClosingEditor closedBy={closedBy} closedDate={closedDate} staff={closerStaff}
        onChange={p => { if (p.closedBy !== undefined) { setClosedBy(p.closedBy); if (p.closedBy && !closedDate) setClosedDate(c.createdAt); } if (p.closedDate !== undefined) setClosedDate(p.closedDate); }} />
      <BonusEditor bonuses={bonuses} staff={closerStaff} defaultMonth={(closedDate || today()).slice(0, 7)} onChange={setBonuses} />
      <div className="mb-3" />

      <SectionHead title="Charges & payments" count={`Overall: ${money(overallPaid(c))} / ${money(overallCharge(c))}`} />
      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <MiniCharge label="Consultation" paid={c.consultPaid} total={c.consultFee} />
        <MiniCharge label="Visa service" paid={c.paid} total={c.fee} />
        <MiniCharge label="Appointment" paid={c.apptPaid} total={c.apptFee} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Consultation fee (total)"><input type="number" value={feeConsult} onChange={e => setFeeConsult(Number(e.target.value) || 0)} /></Field>
        <Field label="Visa service fee (total)"><input type="number" value={feeVisa} onChange={e => setFeeVisa(Number(e.target.value) || 0)} /></Field>
        <Field label="Appointment fee (total)"><input type="number" value={feeAppt} onChange={e => setFeeAppt(Number(e.target.value) || 0)} /></Field>
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
          <div className="rounded-lg p-3 mb-3.5 flex items-center gap-3 flex-wrap" style={{ border: '1px solid var(--line)', background: lastQc?.result === 'Passed' ? 'var(--green-50)' : lastQc ? 'var(--red-50)' : 'var(--gold-50)' }}>
            <div className="flex-1 min-w-[200px] text-[13px]">
              <b>Quality check:</b>{' '}
              {lastQc
                ? <>{lastQc.result} — {lastQc.reviewerName}, {fmtDate(lastQc.date)}{lastQc.result === 'Failed' ? ` · ${lastQc.items.filter(i => !i.ok).length} point(s) to fix` : ''}</>
                : 'not done yet. The file must pass it before it can be approved.'}
            </div>
            <button className="btn btn-sm" onClick={() => setShowQc(true)}>{lastQc ? 'Check again' : 'Run quality check'}</button>
          </div>
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

      <Modal open={showQc} onClose={() => setShowQc(false)} wide>
        {showQc && <QcCheckForm caseId={c.id} onClose={() => setShowQc(false)} />}
      </Modal>
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
  const [payDate, setPayDate] = useState(today());

  function save() {
    if (amount <= 0) { toast('Enter an amount'); return; }
    if (!payDate || payDate > today()) { toast('Enter the date the money was received (today or earlier)'); return; }
    setCases(prev => prev.map(x => {
      if (x.id !== c.id) return x;
      if (target === 'appt') return { ...x, apptPaid: x.apptPaid + amount };
      if (target === 'consult') return { ...x, consultPaid: x.consultPaid + amount };
      return { ...x, paid: x.paid + amount };
    }));
    const labels: Record<string, string> = { case: 'visa fee', appt: 'appointment fee', consult: 'consultation fee' };
    setTransactions(prev => [...prev, {
      id: genId('tx'), date: payDate, type: 'Income',
      category: target === 'appt' ? 'Appointment fee' : target === 'consult' ? 'Consultation fee' : 'Case payment',
      party: c.name, amount, note, caseId: c.id,
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount received (PKR)"><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></Field>
        <Field label="Date received"><input type="date" value={payDate} max={today()} onChange={e => setPayDate(e.target.value)} /></Field>
      </div>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-3">The payment counts in the month of this date — choose the real date when entering an older payment.</div>
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

  const [serviceDescription, setServiceDescription] = useState(`${c.destination} Visit Visa - File Preparation & Consultancy Services${isFamilyCase(c) ? ` (Family file - ${applicantsOf(c)} applicants)` : ''}`);
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
  const { invoices, setInvoices, logActivity, cases, setCases, setTransactions } = useAppData();
  const toast = useToast();
  const inv = invoices.find(i => i.id === invoiceId)!;
  const caseRec = cases.find(x => x.id === inv.caseId);
  const [paymentMethod, setPaymentMethod] = useState('Online (Bank Transfer)');

  function update(patch: Partial<Invoice>) {
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, ...patch } : i));
  }
  // Records the money against the case and in Accounts, so the monthly
  // closing sees it. Returns how much was actually applied.
  function recordToAccounts(amount: number, label: string) {
    if (!caseRec) return 0;
    const { patch, parts, applied } = allocateCasePayment(caseRec, amount);
    if (applied <= 0) return 0;
    setCases(prev => prev.map(x => x.id === caseRec.id ? { ...x, ...patch } : x));
    setTransactions(prev => [...prev, ...parts.map(p => ({
      id: genId('tx'), date: today(), type: 'Income' as const, category: p.category, party: caseRec.name,
      amount: p.amount, note: `${label} — invoice ${inv.invoiceNumber} (${paymentMethod})`, caseId: caseRec.id,
    }))]);
    return applied;
  }
  function confirmAlreadyReceived(received: number) {
    return window.confirm(
      `This case already shows ${money(received)} received.\n\n` +
      `OK = mark the invoice as paid WITHOUT adding a second payment.\n` +
      `Cancel = go back.`);
  }
  function markAdvancePaid() {
    let applied = 0;
    if (caseRec && overallPaid(caseRec) >= inv.advanceAmount) {
      if (!confirmAlreadyReceived(overallPaid(caseRec))) return;
    } else {
      applied = recordToAccounts(inv.advanceAmount, 'Advance');
      if (applied < inv.advanceAmount) toast(`Only ${money(applied)} could be applied to the case balance — check the case fees.`);
    }
    update({ advanceStatus: 'Paid', advancePaidDate: today(), advancePaymentMethod: paymentMethod });
    logActivity(`Advance received for invoice ${inv.invoiceNumber}${applied ? ` — ${money(applied)}` : ''}`);
    if (applied >= inv.advanceAmount) toast('Advance recorded in Accounts');
    else if (!applied) toast('Advance marked as paid');
  }
  function markBalancePaid() {
    let applied = 0;
    if (caseRec && overallPaid(caseRec) >= inv.totalAmount) {
      if (!confirmAlreadyReceived(overallPaid(caseRec))) return;
    } else {
      applied = recordToAccounts(inv.balanceAmount, 'Final balance');
      if (applied < inv.balanceAmount) toast(`Only ${money(applied)} could be applied to the case balance — check the case fees.`);
    }
    update({ balanceStatus: 'Paid', balancePaidDate: today() });
    logActivity(`Balance received for invoice ${inv.invoiceNumber}${applied ? ` — ${money(applied)}` : ''}`);
    if (applied >= inv.balanceAmount) toast('Balance recorded in Accounts');
    else if (!applied) toast('Balance marked as paid');
  }
  function toggleAcknowledged() {
    const next = !inv.clientAcknowledged;
    update({ clientAcknowledged: next, clientAcknowledgedDate: next ? today() : '' });
    if (next) { logActivity(`Client acknowledged terms for invoice ${inv.invoiceNumber}`); toast('Marked as acknowledged by client'); }
  }

  const T: CSSProperties = { border: '1px solid #cfd8dc', padding: '8px 11px', fontSize: 13.5 };
  const TH: CSSProperties = { ...T, background: '#14213D', color: '#fff', fontWeight: 600 };

  return (
    <>
      <div className="no-print flex items-center justify-between mb-3.5">
        <ModalTitle>Invoice {inv.invoiceNumber}</ModalTitle>
        <div className="flex gap-2">
          {!inv.clientAcknowledged
            ? <button className="btn btn-sm" onClick={toggleAcknowledged}>Mark client acknowledged</button>
            : <span className="text-[12px]" style={{ color: 'var(--green)' }}>✓ Acknowledged {fmtDate(inv.clientAcknowledgedDate)}</span>}
          <button className="btn btn-sm btn-primary" onClick={printSheet}>Print / Save as PDF</button>
        </div>
      </div>

      {inv.advanceStatus === 'Due' && (
        <div className="no-print card mb-3" style={{ background: 'var(--gold-50)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[14px]">Advance of {money(inv.advanceAmount)} not yet recorded as paid.<br /><span className="text-[12.5px] text-[var(--muted)]">Marking it paid also records the payment in Accounts — do not record it again under “Record a payment”.</span></span>
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
            <span className="text-[14px]">Balance of {money(inv.balanceAmount)} still pending.<br /><span className="text-[12.5px] text-[var(--muted)]">Marking it paid also records the payment in Accounts.</span></span>
            <button className="btn btn-sm" onClick={markBalancePaid}>Mark balance paid</button>
          </div>
        </div>
      )}

      <div id="invoice-print-area" style={{ background: '#fff', color: '#1a1a1a', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: '#FBF0DD', border: '1px solid #E8C784', padding: '8px 12px', fontSize: 12, marginBottom: 12, lineHeight: 1.45 }}>
          <b>PAYMENT SECURITY ADVISORY:</b> All payments must be made only to the official bank account or other authorized payment account of GoGlobe Consultant.
          Any payment transferred to an employee's personal bank account, mobile wallet, or unauthorized third-party account without official written authorization
          is made at the client's own risk. GoGlobe Consultant shall not be responsible for any loss, misuse, dispute, non-receipt, recovery, reimbursement,
          compensation, or financial protection relating to such unauthorized payment.
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <img src={LOGO_FULL} style={{ height: 54 }} alt="GoGlobe Consultant" />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#14213D' }}>INVOICE</div>
            <div style={{ fontSize: 13 }}><b>Invoice No:</b> {inv.invoiceNumber}</div>
            <div style={{ fontSize: 13 }}><b>Date:</b> {fmtDate(inv.date)}</div>
          </div>
        </div>
        <div style={{ height: 5, background: 'linear-gradient(90deg,#1FA463,#1F6E8C,#14213D)', marginBottom: 12 }} />

        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1, background: '#F2F8F5', padding: 12, fontSize: 13.5, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>BILL TO</div>
            <div>{inv.clientName}</div>
            <div>{inv.destination} Visit Visa Applicant{caseRec && isFamilyCase(caseRec) ? 's' : ''}</div>
            {caseRec && isFamilyCase(caseRec) && (
              <div style={{ fontSize: 12.5, color: '#444' }}>
                <b>Family file - {applicantsOf(caseRec)} applicants:</b> {inv.clientName} (head of family){caseRec.familyMembers!.map(m => `, ${m.name} (${m.relation})`).join('')}
              </div>
            )}
            {inv.clientCity && <div>{inv.clientCity}</div>}
            <div>{inv.clientPhone}</div>
          </div>
          <div style={{ flex: 1, background: '#F2F8F5', padding: 12, fontSize: 13.5, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>FROM</div>
            <div>GoGlobe Consultant</div>
            <div>Office No. 303, 3rd Floor, Noor Mobile Mall,</div>
            <div>6th Road, Block D, Satellite Town, Rawalpindi.</div>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6, color: '#14213D' }}>SERVICE DETAILS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={TH}>Description</th><th style={{ ...TH, textAlign: 'right', width: 130 }}>Amount (PKR)</th></tr></thead>
          <tbody><tr><td style={T}>{inv.serviceDescription}</td><td style={{ ...T, textAlign: 'right' }}>{inv.totalAmount.toLocaleString()}</td></tr></tbody>
        </table>

        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6, color: '#14213D' }}>PAYMENT SUMMARY</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, textAlign: 'center' }}>
          <thead><tr><th style={TH}>Total Consultancy Fee</th><th style={TH}>Amount Received</th><th style={TH}>Outstanding Balance</th></tr></thead>
          <tbody><tr>
            <td style={{ ...T, fontWeight: 700 }}>PKR {inv.totalAmount.toLocaleString()}</td>
            <td style={{ ...T, fontWeight: 700, color: '#0B6E4F' }}>PKR {((inv.advanceStatus === 'Paid' ? inv.advanceAmount : 0) + (inv.balanceStatus === 'Paid' ? inv.balanceAmount : 0)).toLocaleString()}</td>
            <td style={{ ...T, fontWeight: 700, color: inv.balanceStatus === 'Paid' && inv.advanceStatus === 'Paid' ? '#0B6E4F' : '#B5433A' }}>
              PKR {(inv.totalAmount - ((inv.advanceStatus === 'Paid' ? inv.advanceAmount : 0) + (inv.balanceStatus === 'Paid' ? inv.balanceAmount : 0))).toLocaleString()}
              {inv.advanceStatus === 'Paid' && inv.balanceStatus === 'Paid' ? '' : ' - PENDING'}
            </td>
          </tr></tbody>
        </table>

        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6, color: '#14213D' }}>PAYMENT TERMS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={TH}>Stage</th><th style={TH}>Amount</th><th style={TH}>Due</th><th style={TH}>Status</th></tr></thead>
          <tbody>
            <tr>
              <td style={T}>Advance ({inv.advancePercent}%) - payable against this invoice</td>
              <td style={{ ...T, whiteSpace: 'nowrap' }}>PKR {inv.advanceAmount.toLocaleString()}</td>
              <td style={T}>{inv.advanceStatus === 'Paid' ? fmtDate(inv.advancePaidDate) : 'On invoice'}</td>
              <td style={{ ...T, fontWeight: 700, color: inv.advanceStatus === 'Paid' ? '#0B6E4F' : '#B5433A' }}>{inv.advanceStatus === 'Paid' ? 'Received' : 'DUE NOW'}</td>
            </tr>
            <tr>
              <td style={T}>Balance ({100 - inv.advancePercent}%) - payable when prepared file is collected</td>
              <td style={{ ...T, whiteSpace: 'nowrap' }}>PKR {inv.balanceAmount.toLocaleString()}</td>
              <td style={T}>At file completion / before collection</td>
              <td style={{ ...T, fontWeight: 700, color: inv.balanceStatus === 'Paid' ? '#0B6E4F' : '#B5433A' }}>{inv.balanceStatus === 'Paid' ? 'Received' : 'Pending'}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6, color: '#14213D' }}>PROFESSIONAL TERMS &amp; CONDITIONS OF SERVICE</div>
        <ol style={{ fontSize: 12, lineHeight: 1.55, paddingLeft: 18, marginBottom: 12 }}>
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

        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6, color: '#14213D' }}>CLIENT ACKNOWLEDGEMENT</div>
        <div style={{ fontSize: 12.5, marginBottom: 12 }}>
          By signing below, the client confirms that the invoice details, payment terms, and terms &amp; conditions stated in this document have been read and understood.
        </div>
        <div style={{ display: 'flex', gap: 40, marginBottom: 10 }}>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 5, fontSize: 12.5 }}>CLIENT SIGNATURE</div>
          <div style={{ flex: 1, borderTop: '1px solid #333', paddingTop: 5, fontSize: 12.5 }}>
            AUTHORIZED SIGNATURE / COMPANY STAMP
            {inv.clientAcknowledged && <div style={{ color: '#0B6E4F', fontWeight: 700, marginTop: 2 }}>Acknowledged in system on {fmtDate(inv.clientAcknowledgedDate)}</div>}
          </div>
        </div>

        <div style={{ background: '#14213D', color: '#fff', padding: '10px 14px', fontSize: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
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
