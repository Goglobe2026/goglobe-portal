'use client';
import { useState, useMemo } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { DESTINATIONS, visaTypesFor, LEAD_STAGES, genId, today, fmtDate } from '@/lib/constants';
import { exportToCsv, parseCsv } from '@/lib/csv';
import { normalizeCountry, normalizePlatformSource, normalizeImportPhone, guessColumnMapping } from '@/lib/leadImport';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import type { Lead } from '@/lib/types';

function waLink(phone: string, text: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
function isOverdue(l: Lead) {
  return !!l.nextFollowUp && l.nextFollowUp <= today() && !['Converted', 'Lost'].includes(l.stage);
}

export function Leads({ onConvert }: { onConvert: (lead: Lead) => void }) {
  const { leads, setLeads, team, campaigns, logActivity } = useAppData();
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSheetSync, setShowSheetSync] = useState(false);
  const [lostReasonFor, setLostReasonFor] = useState<string | null>(null);
  const [escalateFor, setEscalateFor] = useState<string | null>(null);
  const [showMaterialsFor, setShowMaterialsFor] = useState<string | null>(null);
  const [msgLead, setMsgLead] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [dueOnly, setDueOnly] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showCountryNotes, setShowCountryNotes] = useState(false);
  const [tourLeadId, setTourLeadId] = useState<string | null>(null);

  const assignable = team.filter(t => ['Sales', 'Management'].includes(t.department) && (!t.employmentStatus || t.employmentStatus === 'Active'));
  const consultantName = (id: string) => team.find(t => t.id === id)?.name || 'Unassigned';

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.destination] = (counts[l.destination] || 0) + 1; });
    return DESTINATIONS.map(d => ({ dest: d, count: counts[d] || 0 })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  }, [leads]);

  const dueCount = leads.filter(isOverdue).length;
  const [search, setSearch] = useState('');

  const filtered = leads.filter(l => {
    if (countryFilter && l.destination !== countryFilter) return false;
    if (dueOnly && !isOverdue(l)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const qDigits = q.replace(/[^0-9]/g, '');
      const nameMatch = l.name.toLowerCase().includes(q);
      const phoneMatch = qDigits.length > 0 && normalizePhone(l.phone).includes(normalizePhone(qDigits));
      if (!nameMatch && !phoneMatch) return false;
    }
    return true;
  });

  function updateStage(id: string, stage: Lead['stage']) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    logActivity(`Lead moved to ${stage}`);
    if (stage === 'Lost') setLostReasonFor(id);
  }
  function setFollowUp(id: string, date: string) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, nextFollowUp: date } : l));
  }
  function remove(id: string) {
    setLeads(prev => prev.filter(l => l.id !== id));
    toast('Lead deleted');
  }
  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)));
  }

  const selectedLeads = leads.filter(l => selected.has(l.id));

  function exportLeads() {
    const ok = exportToCsv('goglobe-leads', leads.map(l => ({
      Name: l.name, Phone: l.phone, Source: l.source, Campaign: l.campaign, Destination: l.destination,
      'Visa Type': l.visaType, Stage: l.stage, 'Assigned To': consultantName(l.assignedTo),
      'Created': l.createdAt, 'Next Follow-up': l.nextFollowUp, 'Last Contacted': l.lastContacted, Notes: l.notes,
    })));
    if (!ok) toast('No leads yet to export');
  }

  return (
    <div>
      <SectionHead title="All leads" count={`${leads.length} total`} action={
        <div className="flex gap-2 ml-auto">
          <button className="btn" onClick={exportLeads}>Export CSV</button>
          <button className="btn" onClick={() => setShowImport(true)}>Import CSV</button>
          <button className="btn" onClick={() => setShowSheetSync(true)}>Sync from Google Sheet</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New lead</button>
        </div>
      } />

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or phone number…"
        className="mb-3.5"
        style={{ maxWidth: 360 }}
      />

      {countryCounts.length > 0 && (
        <div className="card mb-3.5">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-2">Interest by country — click to filter</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" style={countryFilter === null ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}} onClick={() => setCountryFilter(null)}>All ({leads.length})</button>
            {countryCounts.map(c => (
              <button key={c.dest} className="btn btn-sm" style={countryFilter === c.dest ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}} onClick={() => setCountryFilter(c.dest === countryFilter ? null : c.dest)}>
                {c.dest} ({c.count})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <button className="btn btn-sm" style={dueOnly ? { background: 'var(--red)', color: '#fff', borderColor: 'transparent' } : {}} onClick={() => setDueOnly(!dueOnly)}>
          Follow-ups due {dueCount > 0 && `(${dueCount})`}
        </button>
        <button className="btn btn-sm" onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}>
          {viewMode === 'list' ? 'Calendar view' : 'List view'}
        </button>
        <button className="btn btn-sm" onClick={() => setShowCountryNotes(true)}>Country updates</button>
        {selected.size > 0 && (
          <>
            <button className="btn btn-sm" style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff' }} onClick={() => setShowQueue(true)}>
              WhatsApp follow-up ({selected.size} selected)
            </button>
            <select className="btn btn-sm" defaultValue="" onChange={e => {
              if (!e.target.value) return;
              setLeads(prev => prev.map(l => selected.has(l.id) ? { ...l, assignedTo: e.target.value } : l));
              toast(`Assigned ${selected.size} lead${selected.size === 1 ? '' : 's'}`);
              setSelected(new Set());
              e.target.value = '';
            }}>
              <option value="">Assign {selected.size} selected to…</option>
              {assignable.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        )}
      </div>

      {viewMode === 'calendar' && <FollowUpCalendar leads={leads} />}

      {viewMode === 'list' && (!filtered.length ? (
        <EmptyState title={leads.length ? 'No leads match this filter' : 'No leads yet'} body="Add your first enquiry from WhatsApp, the website form or a referral." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr>
              <th><input type="checkbox" className="!w-auto" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
              <th>Name</th><th>Source / campaign</th><th>Destination</th><th>Consultant</th><th>Stage</th><th>Next follow-up</th><th>Messages</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(l => {
                const overdue = isOverdue(l);
                return (
                  <tr key={l.id} style={overdue ? { background: 'var(--red-50)' } : undefined}>
                    <td><input type="checkbox" className="!w-auto" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} /></td>
                    <td className="font-medium">{l.name}<div className="font-mono-ui text-xs text-[var(--muted)]">{l.phone}</div></td>
                    <td>{l.source}{l.campaign && <div className="font-mono-ui text-xs" style={{ color: 'var(--gold)' }}>{l.campaign}</div>}</td>
                    <td>{l.destination}</td>
                    <td>
                      <select className="border-none bg-transparent font-medium p-0.5" value={l.assignedTo || ''} onChange={e => setLeads(prev => prev.map(x => x.id === l.id ? { ...x, assignedTo: e.target.value } : x))}>
                        <option value="">Unassigned</option>
                        {assignable.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="border-none bg-transparent font-medium p-0.5" value={l.stage} onChange={e => updateStage(l.id, e.target.value as Lead['stage'])}>
                        {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="date" className="font-mono-ui !w-36" value={l.nextFollowUp || ''} onChange={e => setFollowUp(l.id, e.target.value)} />
                      {overdue && <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--red)' }}>Overdue</div>}
                      {l.escalated && !l.escalationResolved && <div className="text-[10.5px] mt-0.5 font-medium" style={{ color: 'var(--gold)' }}>⚑ Escalated</div>}
                    </td>
                    <td><button className="btn btn-sm btn-ghost" onClick={() => setMsgLead(l)}>{l.messages.length} logged</button></td>
                    <td>
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <a className="btn btn-sm" style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff' }} target="_blank"
                          href={waLink(l.phone, `Hello ${l.name}, this is GoGlobe Consultant regarding your ${l.destination} visa enquiry.`)}>WhatsApp</a>
                        <button className="btn btn-sm" onClick={() => onConvert(l)}>Convert</button>
                        <button className="btn btn-sm" onClick={() => setShowMaterialsFor(l.id)}>Send materials</button>
                        {!l.escalated || l.escalationResolved ? (
                          <button className="btn btn-sm" onClick={() => setEscalateFor(l.id)}>Escalate</button>
                        ) : (
                          <button className="btn btn-sm" style={{ background: 'var(--gold-50)' }} onClick={() => setLeads(prev => prev.map(x => x.id === l.id ? { ...x, escalationResolved: true } : x))}>Mark resolved</button>
                        )}
                        <button className="btn btn-sm" onClick={() => setTourLeadId(l.id)}>Add to tour</button>
                        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => remove(l.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <NewLeadForm onClose={() => setShowNew(false)} assignable={assignable} campaigns={campaigns} />
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} wide>
        <ImportLeadsForm onClose={() => setShowImport(false)} />
      </Modal>

      <Modal open={showSheetSync} onClose={() => setShowSheetSync(false)}>
        <SheetSyncForm onClose={() => setShowSheetSync(false)} />
      </Modal>

      <Modal open={!!msgLead} onClose={() => setMsgLead(null)}>
        {msgLead && <MessageLog lead={msgLead} onClose={() => setMsgLead(null)} />}
      </Modal>

      <Modal open={showQueue} onClose={() => { setShowQueue(false); setSelected(new Set()); }} wide>
        {showQueue && <WhatsAppQueue leads={selectedLeads} onClose={() => { setShowQueue(false); setSelected(new Set()); }} />}
      </Modal>

      <Modal open={!!tourLeadId} onClose={() => setTourLeadId(null)}>
        {tourLeadId && <AddToTourModal leadId={tourLeadId} onClose={() => setTourLeadId(null)} />}
      </Modal>

      <Modal open={showCountryNotes} onClose={() => setShowCountryNotes(false)} wide>
        <CountryNotesPanel onClose={() => setShowCountryNotes(false)} />
      </Modal>

      <Modal open={!!lostReasonFor} onClose={() => setLostReasonFor(null)}>
        {lostReasonFor && <LostReasonForm leadId={lostReasonFor} onClose={() => setLostReasonFor(null)} />}
      </Modal>

      <Modal open={!!escalateFor} onClose={() => setEscalateFor(null)}>
        {escalateFor && <EscalateForm leadId={escalateFor} onClose={() => setEscalateFor(null)} />}
      </Modal>

      <Modal open={!!showMaterialsFor} onClose={() => setShowMaterialsFor(null)}>
        {showMaterialsFor && <SendMaterialsForm leadId={showMaterialsFor} onClose={() => setShowMaterialsFor(null)} />}
      </Modal>
    </div>
  );
}

function WhatsAppQueue({ leads, onClose }: { leads: Lead[]; onClose: () => void }) {
  const { setLeads } = useAppData();
  const [index, setIndex] = useState(0);
  const current = leads[index];
  const done = index >= leads.length;

  function markContactedAndNext() {
    setLeads(prev => prev.map(l => l.id === current.id
      ? { ...l, lastContacted: today(), messages: [...l.messages, { date: today(), text: 'Followed up via WhatsApp', direction: 'Out' as const }] }
      : l));
    setIndex(i => i + 1);
  }
  function skip() { setIndex(i => i + 1); }

  if (done) {
    return (
      <>
        <ModalTitle>All done</ModalTitle>
        <p style={{ marginBottom: 16 }}>You&apos;ve gone through all {leads.length} selected leads.</p>
        <ModalFoot><button className="btn btn-primary" onClick={onClose}>Close</button></ModalFoot>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-1">
        <ModalTitle>WhatsApp follow-up queue</ModalTitle>
        <span className="text-[12.5px] text-[var(--muted)] font-mono-ui">{index + 1} of {leads.length}</span>
      </div>
      <div className="flex gap-1 mb-4">
        {leads.map((_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= index ? 'var(--navy)' : 'var(--line)' }} />
        ))}
      </div>
      <div className="card mb-4">
        <div className="font-display font-semibold text-lg">{current.name}</div>
        <div className="text-[var(--muted)] text-sm mt-1">{current.destination} · {current.visaType} · {current.stage}</div>
        <div className="font-mono-ui text-sm mt-1">{current.phone}</div>
        {current.notes && <div className="text-sm mt-3 italic text-[var(--muted)]">&quot;{current.notes}&quot;</div>}
      </div>
      <a
        className="btn btn-primary w-full mb-3 text-center block"
        style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)' }}
        target="_blank"
        href={waLink(current.phone, `Hello ${current.name}, this is GoGlobe Consultant following up on your ${current.destination} visa enquiry. Is now a good time to talk?`)}
      >
        Open WhatsApp for {current.name}
      </a>
      <ModalFoot>
        <button className="btn" onClick={skip}>Skip</button>
        <button className="btn btn-primary" onClick={markContactedAndNext}>Mark contacted &amp; next</button>
      </ModalFoot>
    </>
  );
}

function normalizePhone(p: string) { return (p || '').replace(/[^0-9]/g, '').replace(/^92/, '0'); }

function NewLeadForm({ onClose, assignable, campaigns }: any) {
  const { leads, cases, setLeads, logActivity } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [source, setSource] = useState('WhatsApp'); const [campaign, setCampaign] = useState('');
  const [dest, setDest] = useState<string>(DESTINATIONS[0]); const [visaType, setVisaType] = useState(visaTypesFor(DESTINATIONS[0])[0]);
  const [assignedTo, setAssignedTo] = useState(assignable[0]?.id || ''); const [notes, setNotes] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState(today());

  const normalizedInput = normalizePhone(phone);
  const duplicateLead = normalizedInput.length >= 7 ? leads.find((l: Lead) => normalizePhone(l.phone) === normalizedInput) : null;
  const duplicateCase = normalizedInput.length >= 7 ? cases.find((c: any) => normalizePhone(c.phone) === normalizedInput) : null;

  function save() {
    if (!name.trim()) { toast('Enter a name'); return; }
    setLeads((prev: Lead[]) => [...prev, {
      id: genId('ld'), name, phone, source, campaign, destination: dest, visaType, stage: 'New',
      assignedTo, createdAt: today(), notes, messages: [], nextFollowUp, lastContacted: '',
      escalated: false, escalationReason: '', escalationResolved: false, lostReason: '',
    }]);
    logActivity(`New lead: ${name}`);
    toast('Lead added');
    onClose();
  }

  return (
    <>
      <ModalTitle>New lead</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} placeholder="Client name" /></Field>
        <Field label="Phone / WhatsApp"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03XX XXXXXXX" /></Field>
      </div>
      {(duplicateLead || duplicateCase) && (
        <div className="card mb-3" style={{ background: 'var(--gold-50)' }}>
          <div className="text-[12.5px]" style={{ color: '#6b4e10' }}>
            ⚠ This phone number already exists {duplicateLead ? `as a lead for ${duplicateLead.name}` : ''}{duplicateLead && duplicateCase ? ' and ' : ''}{duplicateCase ? `as a case for ${duplicateCase.name}` : ''}. You can still save this — just worth checking it's not the same person before two people end up chasing them separately.
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Source">
          <select value={source} onChange={e => setSource(e.target.value)}>
            {['WhatsApp', 'Website', 'Facebook', 'Instagram', 'Referral', 'Walk-in'].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Campaign (if any)">
          <select value={campaign} onChange={e => setCampaign(e.target.value)}>
            <option value="">— None —</option>
            {campaigns.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Destination">
          <select value={dest} onChange={e => { setDest(e.target.value); setVisaType(visaTypesFor(e.target.value)[0]); }}>
            {DESTINATIONS.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Visa type">
          <select value={visaType} onChange={e => setVisaType(e.target.value)}>
            {visaTypesFor(dest).map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Assign to">
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            {assignable.map((t: any) => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}
          </select>
        </Field>
        <Field label="Next follow-up"><input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save lead</button>
      </ModalFoot>
    </>
  );
}

function MessageLog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { setLeads } = useAppData();
  const [text, setText] = useState(''); const [direction, setDirection] = useState<'In' | 'Out'>('In');
  const toast = useToast();

  function add() {
    if (!text.trim()) { toast('Enter a message'); return; }
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, messages: [...l.messages, { date: today(), text, direction }] } : l));
    setText('');
  }
  const current = useAppData().leads.find(l => l.id === lead.id) || lead;

  return (
    <>
      <ModalTitle>Message log — {lead.name}</ModalTitle>
      <div className="max-h-64 overflow-auto mb-3.5">
        {current.messages.length ? current.messages.map((m, i) => (
          <div key={i} className="flex gap-2.5 py-2 border-b last:border-0 items-start" style={{ borderColor: 'var(--line)' }}>
            <Stamp text={m.direction === 'In' ? 'New' : 'Active'} className="!transform-none" />
            <span className="flex-1">{m.text}<div className="font-mono-ui text-xs mt-0.5">{m.date}</div></span>
          </div>
        )) : <div className="text-[var(--muted)] py-2.5">No messages logged yet.</div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Direction">
          <select value={direction} onChange={e => setDirection(e.target.value as any)}>
            <option value="In">Inbound</option><option value="Out">Outbound</option>
          </select>
        </Field>
        <Field label="Message"><input value={text} onChange={e => setText(e.target.value)} placeholder="What was said" /></Field>
      </div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={add}>Add to log</button>
      </ModalFoot>
    </>
  );
}

function FollowUpCalendar({ leads }: { leads: Lead[] }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay: Record<string, Lead[]> = {};
  leads.forEach(l => { if (l.nextFollowUp && l.nextFollowUp.slice(0, 7) === month) { (byDay[l.nextFollowUp] ||= []).push(l); } });

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3.5">
        <button className="btn btn-sm" onClick={() => { const d = new Date(y, m - 2, 1); setMonth(d.toISOString().slice(0, 7)); setSelectedDay(null); }}>‹ Prev</button>
        <div className="font-display font-semibold text-[15px]">{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
        <button className="btn btn-sm" onClick={() => { const d = new Date(y, m, 1); setMonth(d.toISOString().slice(0, 7)); setSelectedDay(null); }}>Next ›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="font-mono-ui text-[10.5px] text-[var(--faint)] text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => <div key={'pad' + i} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayLeads = byDay[dateStr] || [];
          const isToday = dateStr === today();
          const isSelected = dateStr === selectedDay;
          return (
            <div key={d} onClick={() => setSelectedDay(dayLeads.length ? dateStr : null)}
              className="rounded-[10px] p-1.5 min-h-16 cursor-pointer transition-shadow hover:shadow-sm"
              style={{ border: `1px solid ${isSelected ? 'var(--navy)' : isToday ? 'var(--navy-light)' : 'var(--line)'}`, background: isSelected ? 'var(--navy-50)' : isToday ? '#F7FBF9' : '#fff' }}>
              <div className="font-mono-ui text-[11px]" style={{ color: isToday ? 'var(--navy)' : 'var(--muted)', fontWeight: isToday ? 700 : 500 }}>{d}</div>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {dayLeads.slice(0, 4).map(l => <span key={l.id} title={l.name} className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--red)' }} />)}
                {dayLeads.length > 4 && <span className="font-mono-ui text-[9.5px] text-[var(--faint)]">+{dayLeads.length - 4}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[11.5px] text-[var(--faint)] mt-2.5">Red dots show leads due for follow-up that day. Click a day to see who.</div>
      {selectedDay && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <div className="text-[12.5px] font-semibold mb-2">Follow-ups due {fmtDate(selectedDay)}</div>
          {(byDay[selectedDay] || []).map(l => (
            <div key={l.id} className="flex justify-between items-center py-1.5 text-[13px]">
              <span>{l.name} <span className="text-[var(--muted)] text-[11px]">— {l.destination}</span></span>
              <Stamp text={l.stage} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddToTourModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { leads, groupTours, tourMembers, setTourMembers, setLeads, logActivity } = useAppData();
  const toast = useToast();
  const lead = leads.find(l => l.id === leadId)!;
  const [tourId, setTourId] = useState(groupTours[0]?.id || '');

  function genMemberCode(tourCode: string, tId: string) {
    const n = tourMembers.filter(m => m.tourId === tId).length + 1;
    return `GG-${tourCode}-${String(n).padStart(3, '0')}`;
  }

  function save() {
    if (!tourId) { toast('Create a group tour first'); return; }
    const tour = groupTours.find(t => t.id === tourId)!;
    const referenceCode = genMemberCode(tour.tourCode, tourId);
    setTourMembers(prev => [...prev, {
      id: genId('tmb'), tourId, referenceCode, name: lead.name, fatherName: '', phone: lead.phone, whatsapp: lead.phone,
      email: '', cnic: '', passportNumber: '', passportExpiry: '', nationality: 'Pakistani', emergencyContact: '',
      address: '', paid: 0, totalDue: tour.packagePrice, status: 'Registered', bookingDate: today(),
    }]);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: 'Converted' } : l));
    logActivity(`${lead.name} registered for tour: ${tour.name}`);
    toast('Added to tour — reference code generated');
    onClose();
  }

  if (!groupTours.length) {
    return (
      <>
        <ModalTitle>No group tours yet</ModalTitle>
        <p style={{ marginBottom: 16 }}>Create a group tour first from the Group Tours tab, then come back and add this lead to it.</p>
        <ModalFoot><button className="btn btn-primary" onClick={onClose}>Close</button></ModalFoot>
      </>
    );
  }

  return (
    <>
      <ModalTitle>Add to group tour — {lead.name}</ModalTitle>
      <Field label="Which tour">
        <select value={tourId} onChange={e => setTourId(e.target.value)}>
          {groupTours.map(t => <option key={t.id} value={t.id}>{t.name} ({t.tourCode})</option>)}
        </select>
      </Field>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-3">This creates a traveler registration with a verification code — the lead moves to Converted, same as when a lead becomes a visa case.</div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Register for this tour</button>
      </ModalFoot>
    </>
  );
}

function CountryNotesPanel({ onClose }: { onClose: () => void }) {
  const { countryNotes, setCountryNotes } = useAppData();
  const toast = useToast();
  const [country, setCountry] = useState<string>(DESTINATIONS[0]);
  const [note, setNote] = useState('');
  const [filterCountry, setFilterCountry] = useState<string | null>(null);

  function addNote() {
    if (!note.trim()) { toast('Enter a note'); return; }
    setCountryNotes(prev => [{ id: genId('cn'), country, note, createdAt: today() }, ...prev]);
    setNote('');
    toast('Note added');
  }
  function removeNote(id: string) {
    setCountryNotes(prev => prev.filter(n => n.id !== id));
  }

  const filtered = filterCountry ? countryNotes.filter(n => n.country === filterCountry) : countryNotes;

  return (
    <>
      <ModalTitle>Country updates</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-4">Keep track of visa fee changes, embassy holidays, or anything worth knowing before quoting a client — per country, visible to your whole team.</div>
      <div className="grid grid-cols-[140px_1fr] gap-3 mb-3">
        <Field label="Country">
          <select value={country} onChange={e => setCountry(e.target.value)}>{DESTINATIONS.map(d => <option key={d}>{d}</option>)}</select>
        </Field>
        <Field label="Update"><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. UK visa fee increased to £115 from March" /></Field>
      </div>
      <button className="btn btn-sm mb-4" onClick={addNote}>+ Add update</button>

      <div className="flex flex-wrap gap-2 mb-3">
        <button className="btn btn-sm" style={filterCountry === null ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}} onClick={() => setFilterCountry(null)}>All</button>
        {DESTINATIONS.filter(d => countryNotes.some(n => n.country === d)).map(d => (
          <button key={d} className="btn btn-sm" style={filterCountry === d ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}} onClick={() => setFilterCountry(d)}>{d}</button>
        ))}
      </div>

      <div className="max-h-72 overflow-auto">
        {filtered.length ? filtered.map(n => (
          <div key={n.id} className="flex justify-between items-start gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--line)' }}>
            <div>
              <span className="font-medium text-[13px]">{n.country}</span>
              <div className="text-[13px] mt-0.5">{n.note}</div>
              <div className="font-mono-ui text-[10.5px] text-[var(--faint)] mt-1">{fmtDate(n.createdAt)}</div>
            </div>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removeNote(n.id)}>Remove</button>
          </div>
        )) : <div className="text-[var(--muted)] py-4 text-[13px]">No updates logged yet.</div>}
      </div>

      <ModalFoot><button className="btn btn-primary" onClick={onClose}>Close</button></ModalFoot>
    </>
  );
}

const IMPORT_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'phone', label: 'Phone number', required: true },
  { key: 'email', label: 'Email (optional)', required: false },
  { key: 'destination', label: 'Country / destination (optional)', required: false },
  { key: 'platform', label: 'Source / platform (optional)', required: false },
  { key: 'campaign', label: 'Campaign (optional)', required: false },
  { key: 'city', label: 'City (optional)', required: false },
];

function ImportLeadsForm({ onClose }: { onClose: () => void }) {
  const { leads, setLeads } = useAppData();
  const toast = useToast();
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ imported: number; duplicates: number; incomplete: number } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { headers: h, rows: r } = parseCsv(text);
      setHeaders(h);
      setRows(r);
      setMapping(guessColumnMapping(h));
    };
    reader.readAsText(file);
  }

  function colIndex(field: string) {
    const header = mapping[field];
    return header ? headers.indexOf(header) : -1;
  }

  function runImport() {
    const nameIdx = colIndex('name');
    const phoneIdx = colIndex('phone');
    if (nameIdx === -1 || phoneIdx === -1) { toast('Map at least Name and Phone before importing'); return; }

    const emailIdx = colIndex('email');
    const destIdx = colIndex('destination');
    const platformIdx = colIndex('platform');
    const campaignIdx = colIndex('campaign');
    const cityIdx = colIndex('city');

    const existingPhones = new Set(leads.map((l: Lead) => normalizePhone(l.phone)));
    const newLeads: Lead[] = [];
    let duplicates = 0, incomplete = 0;

    for (const row of rows) {
      const name = row[nameIdx]?.trim();
      const rawPhone = normalizeImportPhone(row[phoneIdx] || '');
      if (!name || !rawPhone) { incomplete++; continue; }
      if (existingPhones.has(normalizePhone(rawPhone))) { duplicates++; continue; }

      const noteParts: string[] = [];
      if (emailIdx > -1 && row[emailIdx]) noteParts.push(`Email: ${row[emailIdx]}`);
      if (cityIdx > -1 && row[cityIdx]) noteParts.push(`City: ${row[cityIdx]}`);

      newLeads.push({
        id: genId('ld'), name, phone: rawPhone,
        source: platformIdx > -1 ? normalizePlatformSource(row[platformIdx]) : 'Website',
        campaign: campaignIdx > -1 ? (row[campaignIdx] || '') : '',
        destination: destIdx > -1 ? normalizeCountry(row[destIdx]) : '',
        visaType: '', stage: 'New', assignedTo: '', createdAt: today(),
        notes: noteParts.join(' · '), messages: [], nextFollowUp: today(), lastContacted: '',
        escalated: false, escalationReason: '', escalationResolved: false, lostReason: '',
      });
      existingPhones.add(normalizePhone(rawPhone)); // guard against duplicates within the file itself
    }

    if (newLeads.length) setLeads((prev: Lead[]) => [...prev, ...newLeads]);
    setResult({ imported: newLeads.length, duplicates, incomplete });
  }

  return (
    <>
      <ModalTitle>Import leads from CSV</ModalTitle>

      {!headers.length ? (
        <>
          <div className="text-[12.5px] text-[var(--muted)] mb-3">
            Upload a CSV export — from Facebook Lead Ads, Excel (save as CSV), or Google Sheets (File → Download → CSV). No need to reformat anything first; you'll match the columns on the next screen.
          </div>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </>
      ) : (
        <>
          <div className="text-[12.5px] text-[var(--muted)] mb-3">
            <b>{fileName}</b> — found {rows.length} row{rows.length === 1 ? '' : 's'}. Columns were matched automatically where possible — check they're right, or change any that look wrong.
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {IMPORT_FIELDS.map(f => (
              <Field key={f.key} label={f.label}>
                <select value={mapping[f.key] || ''} onChange={e => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}>
                  <option value="">— not in this file —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
            ))}
          </div>

          {rows.length > 0 && (
            <div className="mb-4">
              <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-2">Preview — first 3 rows</div>
              <div className="card p-0 overflow-auto">
                <table>
                  <thead><tr><th>Name</th><th>Phone</th><th>Destination</th><th>Source</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        <td>{colIndex('name') > -1 ? row[colIndex('name')] : '—'}</td>
                        <td className="font-mono-ui text-xs">{colIndex('phone') > -1 ? normalizeImportPhone(row[colIndex('phone')]) : '—'}</td>
                        <td>{colIndex('destination') > -1 ? normalizeCountry(row[colIndex('destination')]) : '—'}</td>
                        <td>{colIndex('platform') > -1 ? normalizePlatformSource(row[colIndex('platform')]) : 'Website'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="card mb-4" style={{ background: 'var(--green-50)' }}>
              <div className="text-[13px] font-medium" style={{ color: 'var(--green)' }}>
                Imported {result.imported} new lead{result.imported === 1 ? '' : 's'}.
                {result.duplicates > 0 && ` Skipped ${result.duplicates} — already existed (matching phone number).`}
                {result.incomplete > 0 && ` Skipped ${result.incomplete} — missing a name or phone number.`}
              </div>
            </div>
          )}
        </>
      )}

      <ModalFoot>
        <button className="btn" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
        {headers.length > 0 && !result && <button className="btn btn-primary" onClick={runImport}>Import {rows.length} row{rows.length === 1 ? '' : 's'}</button>}
      </ModalFoot>
    </>
  );
}

const LOST_REASONS = ['Went with a competitor', 'Budget / price too high', 'Not interested anymore', 'Not responding', 'Visa not suitable for their case', 'Other'];

function LostReasonForm({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { leads, setLeads } = useAppData();
  const lead = leads.find(l => l.id === leadId);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [note, setNote] = useState('');

  function save() {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lostReason: note ? `${reason} — ${note}` : reason } : l));
    onClose();
  }

  if (!lead) return null;
  return (
    <>
      <ModalTitle>Why was this one lost? — {lead.name}</ModalTitle>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-3">Optional, but this is the only way to actually see patterns in what's costing you deals.</div>
      <Field label="Reason">
        <select value={reason} onChange={e => setReason(e.target.value)}>
          {LOST_REASONS.map(r => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Any detail (optional)"><input value={note} onChange={e => setNote(e.target.value)} /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Skip</button>
        <button className="btn btn-primary" onClick={save}>Save reason</button>
      </ModalFoot>
    </>
  );
}

function EscalateForm({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { leads, setLeads, logActivity } = useAppData();
  const toast = useToast();
  const lead = leads.find(l => l.id === leadId);
  const [reason, setReason] = useState('');

  function save() {
    if (!reason.trim()) { toast('Explain what you need help with'); return; }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, escalated: true, escalationReason: reason, escalationResolved: false } : l));
    logActivity(`${lead?.name} escalated to manager: ${reason}`);
    toast('Escalated — your manager will see this in their review queue');
    onClose();
  }

  if (!lead) return null;
  return (
    <>
      <ModalTitle>Escalate to manager — {lead.name}</ModalTitle>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-3">This shows up in the Management team's review queue, the same place case approvals go.</div>
      <Field label="What do you need from them?"><textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Client is asking for a discount I can't approve" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Escalate</button>
      </ModalFoot>
    </>
  );
}

function SendMaterialsForm({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { leads, marketingMaterials } = useAppData();
  const lead = leads.find(l => l.id === leadId);
  const [picked, setPicked] = useState<string>(marketingMaterials[0]?.id || '');
  if (!lead) return null;

  if (!marketingMaterials.length) {
    return (
      <>
        <ModalTitle>No materials uploaded yet</ModalTitle>
        <p style={{ marginBottom: 16 }}>Upload flyers or brochures from the Campaigns tab first, then come back here to send one to {lead.name}.</p>
        <ModalFoot><button className="btn btn-primary" onClick={onClose}>Close</button></ModalFoot>
      </>
    );
  }

  const material = marketingMaterials.find(m => m.id === picked);
  const materialLink = material && typeof window !== 'undefined' ? `${window.location.origin}/api/materials/${material.id}` : '';
  const message = `Hello ${lead.name}, this is GoGlobe Consultant — here's our ${lead.destination} information: ${materialLink}`;

  return (
    <>
      <ModalTitle>Send materials — {lead.name}</ModalTitle>
      <div className="text-[11.5px] text-[var(--faint)] mb-3">
        The link opens the PDF directly in their browser — no attaching needed on your end, just pick one and hit send.
      </div>
      <Field label="Which material">
        <select value={picked} onChange={e => setPicked(e.target.value)}>
          {marketingMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      <a className="btn btn-primary w-full text-center" style={{ textDecoration: 'none' }} target="_blank"
        href={waLink(lead.phone, message)}>
        Open WhatsApp with link ready to send
      </a>
      <ModalFoot><button className="btn" onClick={onClose}>Close</button></ModalFoot>
    </>
  );
}

function SheetSyncForm({ onClose }: { onClose: () => void }) {
  const { sheetSyncUrl, setSheetSyncUrl } = useAppData();
  const toast = useToast();
  const [url, setUrl] = useState(sheetSyncUrl);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; incomplete: number } | { error: string } | null>(null);

  function save() {
    setSheetSyncUrl(url.trim());
    toast('Link saved');
  }

  async function syncNow() {
    if (!url.trim()) { toast('Paste and save your published sheet link first'); return; }
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/sync-sheet', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error || 'Something went wrong' });
      else setResult(data);
    } catch {
      setResult({ error: 'Could not reach the server' });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <ModalTitle>Sync leads from Google Sheet</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3 leading-relaxed">
        One-time setup in Google Sheets: <b>File → Share → Publish to web</b> → choose the sheet with your leads → set format to <b>Comma-separated values (.csv)</b> → click Publish. Paste the link it gives you below.
      </div>
      <Field label="Published sheet link">
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" />
      </Field>
      <button className="btn btn-sm mb-4" onClick={save}>Save link</button>

      {result && 'error' in result && (
        <div className="card mb-4" style={{ background: 'var(--red-50)' }}>
          <div className="text-[13px]" style={{ color: 'var(--red)' }}>{result.error}</div>
        </div>
      )}
      {result && 'imported' in result && (
        <div className="card mb-4" style={{ background: 'var(--green-50)' }}>
          <div className="text-[13px] font-medium" style={{ color: 'var(--green)' }}>
            Imported {result.imported} new lead{result.imported === 1 ? '' : 's'}.
            {result.duplicates > 0 && ` Skipped ${result.duplicates} already in the system.`}
            {result.incomplete > 0 && ` Skipped ${result.incomplete} missing a name or phone.`}
          </div>
        </div>
      )}

      <ModalFoot>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={syncNow} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync now'}</button>
      </ModalFoot>
    </>
  );
}
