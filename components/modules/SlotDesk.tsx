'use client';
import { useEffect, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { DESTINATIONS, fmtDate, genId, money, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, EmptyState, Stamp } from '@/components/ui/Primitives';
import { StatCard, Panel, PillTabs, Callout, BarList, initials } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';
import {
  DAY_NAMES, HOW_BOOKED, clock12, clientBookedMessage, clientReadyMessage, countdown, dayLabel, daysToTravel, isWaiting, nextOpening,
  premiumByMonth, premiumStats, resultStats, rotaMessage, soonestOpening, sortWaiting, waitingFor, waUrl, addDaysIso, pktDate,
  packLines, packText, alertMessage, SLOT_COUNTRIES, countryMatches, openingPattern, liveBoard, liveCounts, liveLabel, liveReset, joinNowMessage, PRIORITY_COUNTRIES,
} from '@/lib/slotdesk';
import { SLOT_GUIDES, GUIDES_CHECKED_ON, UNCHECKED_HOW_TO } from '@/lib/slotguides';
import { READINESS_ITEMS, VISA_TYPES, readiness, findDuplicateCase } from '@/lib/slotdesk';
import { MAX_ATTEMPTS, alertTeamMessage, configFor, fmtPkt, sendState, topicFor, CATEGORY_INFO } from '@/lib/slotalerts';
import { CASE_COLUMNS, casesReport, downloadCsv } from '@/lib/slotreport';
import { StandbyTab } from '@/components/modules/SlotDeskStandby';
import { RoundPanel, RoundBody, CheckHistory } from '@/components/modules/SlotDeskRound';
import { OverviewTab, AlertsTab, AlertLogForm, ProvidersTab, AuditTab, TONE, useAudit, useWho, type SlotTab } from '@/components/modules/SlotDeskPanels';
import type { SlotRequest, SlotRelease, SlotAttempt, SlotHow, SlotLive, SlotAlert, TeamMember, Appointment } from '@/lib/types';

// Slot Desk — for the Head Manager and admins. It helps the team be ready when a centre opens new
// appointment dates and keeps track of what happened. It never connects to a visa website: people
// book on the official site themselves (the client, with our guidance, or our team).

type Tab = SlotTab;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
const activeStaff = (team: TeamMember[]) => team.filter(t => t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave');
const WA_BTN = { background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff', borderColor: 'transparent' } as const;

export function SlotDesk() {
  const { slotWaiting, setSlotWaiting, slotReleases, setSlotReleases, slotLog, setSlotLog, slotAlerts, team, appointments, setAppointments } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const now = useNow(1000);
  const [tab, setTab] = useState<Tab>('overview');
  const [editReq, setEditReq] = useState<SlotRequest | 'new' | null>(null);
  const [bookReq, setBookReq] = useState<SlotRequest | null>(null);
  const [editRel, setEditRel] = useState<SlotRelease | 'new' | null>(null);
  const [logFor, setLogFor] = useState<{ releaseId: string } | null>(null);
  const [packReq, setPackReq] = useState<SlotRequest | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [teamAlert, setTeamAlert] = useState<SlotAlert | null>(null);
  const [logAlert, setLogAlert] = useState<{ country: string } | null>(null);
  const [liveStart, setLiveStart] = useState<{ country: string; centre: string } | null>(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [roundOpen, setRoundOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const waiting = slotWaiting.filter(isWaiting);
  const who = useWho();
  const soon = soonestOpening(slotReleases, now);
  const watchingAppts = appointments.filter(a => a.status === 'Watching for slot' && !slotWaiting.some(r => r.apptId === a.id));
  const unhandled = slotAlerts.filter(a => !a.handled && now - (Date.parse(a.at) || 0) < 48 * 3600000).length;
  const goLive = (country: string, centre = '') => { setLiveStart({ country, centre }); setTab('live'); };
  const closeAlert = () => { setAlertOpen(false); setTeamAlert(null); };
  // the reminder banner (or the sidebar) can ask for the check round, whether or not this screen was already open
  useEffect(() => {
    const open = () => { try { window.localStorage.removeItem('slot-open-round'); } catch { /* ignore */ } setTab('overview'); setRoundOpen(true); };
    try { if (window.localStorage.getItem('slot-open-round') === '1') open(); } catch { /* ignore */ }
    window.addEventListener('slot-start-round', open);
    return () => window.removeEventListener('slot-start-round', open);
  }, []);

  return (
    <div data-testid="slot-desk">
      {/* ---- the next opening ---- */}
      <NextOpeningCard soon={soon} now={now} waitingCount={soon ? waitingFor(soon.release, slotWaiting).length : 0} team={team}
        onLog={id => setLogFor({ releaseId: id })} onAlert={() => setAlertOpen(true)} onAdd={() => { setTab('releases'); setEditRel('new'); }} />

      <div className="mt-4 mb-4">
        <PillTabs<Tab> value={tab} onChange={setTab} items={[
          { id: 'overview', label: 'Countries' },
          { id: 'waiting', label: 'Waiting list', badge: waiting.length ? String(waiting.length) : undefined },
          { id: 'standby', label: 'Stand-by' },
          { id: 'live', label: 'Live booking' },
          { id: 'alerts', label: 'Alerts', badge: unhandled ? String(unhandled) : undefined },
          { id: 'releases', label: 'Release times & rota' },
          { id: 'guide', label: 'Where to book' },
          { id: 'providers', label: 'Providers & health' },
          { id: 'results', label: 'Results' },
          { id: 'cost', label: 'Broker cost' },
          { id: 'audit', label: 'Audit trail' },
        ]} />
      </div>

      {tab === 'overview' && <div className="mb-4"><RoundPanel now={now} onStart={() => setRoundOpen(true)} onHistory={() => setHistoryOpen(true)} /></div>}
      {tab === 'overview' && <OverviewTab now={now} onGo={setTab} onLog={c => setLogAlert({ country: c })} onLive={c => goLive(c)} />}
      {tab === 'waiting' && (
        <WaitingTab list={slotWaiting} releases={slotReleases} team={team} watchingAppts={watchingAppts}
          onAdd={() => setEditReq('new')} onEdit={setEditReq} onBook={setBookReq} onPack={setPackReq} onAlert={() => setAlertOpen(true)}
          onBringIn={() => {
            const add: SlotRequest[] = watchingAppts.filter(a => !findDuplicateCase(slotWaiting, { id: '', clientName: a.clientName, phone: a.phone, country: guessCountry(a), centre: a.portal || '' })).map(a => blankReq({ clientName: a.clientName, phone: a.phone, country: guessCountry(a), centre: a.portal || '', apptId: a.id, assignedTo: a.consultant || '' }));
            setSlotWaiting(prev => [...prev, ...add]); audit('Case', `Brought in ${add.length} from Appointments`); toast(`${add.length} client${add.length === 1 ? '' : 's'} brought in from Appointments`);
          }}
          onRemove={r => { setSlotWaiting(prev => prev.filter(x => x.id !== r.id)); audit('Case', 'Removed from the list', { country: r.country, ref: r.clientName }); toast('Removed from the list'); }}
          onCancel={r => { setSlotWaiting(prev => prev.map(x => x.id === r.id ? { ...x, status: 'Cancelled' } : x)); audit('Case', 'Marked cancelled', { country: r.country, ref: r.clientName }); toast('Marked cancelled'); }}
          onReopen={r => { setSlotWaiting(prev => prev.map(x => x.id === r.id ? { ...x, status: 'Waiting', slotDate: '', slotTime: '', bookedAt: '', bookedHow: '', middleman: '', premium: 0, confirmationRef: '', live: '' as SlotLive, liveBy: '' } : x)); audit('Case', 'Back on the waiting list', { country: r.country, ref: r.clientName }); toast('Back on the waiting list'); }} />
      )}
      {tab === 'standby' && <StandbyTab now={now} />}
      {tab === 'live' && <LiveTab key={`${liveStart?.country || ''}|${liveStart?.centre || ''}`} start={liveStart} list={slotWaiting} soon={soon} who={who} onBook={setBookReq} onPack={setPackReq} onAlert={() => setAlertOpen(true)}
        setList={setSlotWaiting} />}
      {tab === 'alerts' && <AlertsTab now={now} onLog={c => setLogAlert({ country: c })} onTeam={setTeamAlert} onLive={goLive} />}
      {tab === 'guide' && <GuideTab />}
      {tab === 'providers' && <ProvidersTab now={now} onLog={c => setLogAlert({ country: c })} />}
      {tab === 'releases' && (
        <ReleasesTab releases={slotReleases} list={slotWaiting} team={team} now={now} onAdd={() => setEditRel('new')} onEdit={setEditRel} onLog={id => setLogFor({ releaseId: id })}
          onToggle={r => { setSlotReleases(prev => prev.map(x => x.id === r.id ? { ...x, active: !x.active } : x)); audit('Release', r.active ? 'Paused an opening time' : 'Switched an opening time on', { country: r.country, ref: r.label || `${r.country} opening` }); }}
          onRemove={r => { setSlotReleases(prev => prev.filter(x => x.id !== r.id)); audit('Release', 'Removed an opening time', { country: r.country, ref: r.label || `${r.country} opening` }); toast('Release time removed'); }} />
      )}
      {tab === 'results' && <ResultsTab log={slotLog} releases={slotReleases} team={team} onLog={() => setLogFor({ releaseId: slotReleases[0]?.id || '' })}
        onRemove={l => { setSlotLog(prev => prev.filter(x => x.id !== l.id)); audit('Result', 'Removed a result', { detail: `${l.date} · ${l.outcome}` }); toast('Result removed'); }} />}
      {tab === 'cost' && <CostTab list={slotWaiting} month={month} setMonth={setMonth} />}
      {tab === 'audit' && <AuditTab />}

      <Modal open={!!editReq} onClose={() => setEditReq(null)} wide>{editReq && <RequestForm req={editReq === 'new' ? null : editReq} onClose={() => setEditReq(null)} />}</Modal>
      <Modal open={!!bookReq} onClose={() => setBookReq(null)}>{bookReq && <BookedForm req={bookReq} onClose={() => setBookReq(null)} />}</Modal>
      <Modal open={!!editRel} onClose={() => setEditRel(null)} wide>{editRel && <ReleaseForm rel={editRel === 'new' ? null : editRel} onClose={() => setEditRel(null)} />}</Modal>
      <Modal open={!!packReq} onClose={() => setPackReq(null)} wide>{packReq && <PackForm req={packReq} onClose={() => setPackReq(null)} />}</Modal>
      <Modal open={alertOpen || !!teamAlert} onClose={closeAlert} wide>{(alertOpen || !!teamAlert) && <AlertForm soon={soon} alert={teamAlert} onClose={closeAlert} />}</Modal>
      <Modal open={!!logAlert} onClose={() => setLogAlert(null)} wide>{logAlert && <AlertLogForm country={logAlert.country} onClose={() => setLogAlert(null)} />}</Modal>
      <Modal open={roundOpen} onClose={() => setRoundOpen(false)} wide>{roundOpen && <RoundBody onClose={() => setRoundOpen(false)} onTeam={a => { setRoundOpen(false); setTeamAlert(a); }} onLive={(c, ce) => { setRoundOpen(false); goLive(c, ce); }} />}</Modal>
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} wide>{historyOpen && <><ModalTitle>Check history</ModalTitle><CheckHistory now={now} /><ModalFoot><button className="btn" onClick={() => setHistoryOpen(false)} data-testid="slot-checks-close">Close</button></ModalFoot></>}</Modal>
      <Modal open={!!logFor} onClose={() => setLogFor(null)}>{logFor && <LogForm releaseId={logFor.releaseId} onClose={() => setLogFor(null)} />}</Modal>
    </div>
  );

  // a client already in Appointments as "Watching for slot" — the country is usually in the appointment type
  function guessCountry(a: Appointment): string {
    const t = `${a.type} ${a.portal}`.toLowerCase();
    const named = SLOT_COUNTRIES.find(c => c !== 'Schengen' && t.includes(c.toLowerCase()));
    return named || (DESTINATIONS as readonly string[]).find(d => t.includes(d.toLowerCase())) || 'Schengen';
  }
}

function blankReq(o: Partial<SlotRequest> = {}): SlotRequest {
  return {
    id: genId('sw'), clientName: '', phone: '', caseId: '', apptId: '', country: 'Spain', centre: '', applicants: 1, travelBy: '', priority: 'Normal', status: 'Waiting',
    slotDate: '', slotTime: '', bookedHow: '', middleman: '', premium: 0, assignedTo: '', note: '', createdAt: today(), bookedAt: '', ...o,
  };
}

// ---------------------------------------------------------------------------------------------
// The big card at the top
// ---------------------------------------------------------------------------------------------
function NextOpeningCard({ soon, now, waitingCount, team, onLog, onAdd, onAlert }: {
  soon: ReturnType<typeof soonestOpening>; now: number; waitingCount: number; team: TeamMember[]; onLog: (releaseId: string) => void; onAdd: () => void; onAlert: () => void;
}) {
  if (!soon) {
    return (
      <Callout tone="info" title="No opening time set yet">
        Add the time your centre says new dates open (for example “Monday to Friday, 3:00 pm”) and this card will count down to it, show who is on duty and how many clients are waiting.
        <div className="mt-2 flex gap-2 flex-wrap"><button className="btn btn-sm btn-primary" onClick={onAdd} data-testid="slot-add-first">+ Add an opening time</button><button className="btn btn-sm" onClick={onAlert} data-testid="slot-alert-next">Slots just opened — alert the team</button></div>
      </Callout>
    );
  }
  const { release: r, next: n } = soon;
  const open = n.state === 'open';
  const when = n.dateIso === pktDate(now) ? 'today' : new Date(n.dateIso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const rota = r.rota.map(id => team.find(t => t.id === id)).filter(Boolean) as TeamMember[];
  return (
    <section className="panel rise" data-testid="slot-next" style={{ background: open ? 'linear-gradient(135deg,#0B6E4F,#1FA463)' : 'linear-gradient(135deg, var(--hero-a), var(--hero-b))', color: '#fff', border: 'none' }}>
      <div className="p-5 flex flex-wrap gap-6 items-center">
        <div style={{ minWidth: 230 }}>
          <div className="text-[11.5px] font-bold uppercase tracking-[.12em]" style={{ opacity: .8 }}>{open ? 'Open now — be on the site' : 'Next opening in'}</div>
          <div className="font-display" data-testid="slot-countdown" style={{ fontSize: 46, fontWeight: 600, lineHeight: 1.05, marginTop: 4 }}>{open ? 'Open now' : countdown(n.msUntil)}</div>
          <div className="text-[13.5px] mt-1.5" style={{ opacity: .92 }}>{r.country}{r.centre ? ` · ${r.centre}` : ''} — {when} at {clock12(n.time)} <span style={{ opacity: .75 }}>(Pakistan time)</span></div>
          {r.label && <div className="text-[12.5px] mt-0.5" style={{ opacity: .8 }}>{r.label}</div>}
          <div className="mt-1.5"><span className="chip" style={r.basis === 'Official notice' ? { background: '#fff', color: '#0B6E4F', fontWeight: 700 } : { background: 'rgba(255,255,255,.22)', color: '#fff' }} data-testid="slot-next-basis">{r.basis === 'Official notice' ? 'Official notice' : 'Our own estimate — not announced'}</span></div>
        </div>
        <div className="flex-1" style={{ minWidth: 240 }}>
          <div className="text-[11.5px] font-bold uppercase tracking-[.1em] mb-2" style={{ opacity: .8 }}>On duty</div>
          {rota.length ? (
            <div className="flex flex-wrap gap-2">
              {rota.map(m => (
                <a key={m.id} className="hero-chip" style={{ textDecoration: 'none', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8 }} target="_blank" rel="noreferrer"
                  href={waUrl(m.phone, rotaMessage(r, m.name, n, now))} title={`Message ${m.name} on WhatsApp`} data-testid="slot-rota-wa">
                  <span style={{ width: 26, height: 26, borderRadius: 99, background: 'rgba(255,255,255,.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials(m.name)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}><b style={{ fontSize: 13 }}>{m.name}</b><span style={{ fontSize: 11, opacity: .8 }}>Message on WhatsApp</span></span>
                </a>
              ))}
            </div>
          ) : <div className="text-[13px]" style={{ opacity: .85 }}>Nobody is on the rota for this opening yet — add names under “Release times & rota”.</div>}
        </div>
        <div className="flex flex-col gap-2 items-stretch">
          <div className="hero-chip"><b data-testid="slot-next-waiting">{waitingCount}</b><span>clients waiting for this</span></div>
          <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--accent-ink)' }} onClick={onAlert} data-testid="slot-alert-next">Slots just opened — alert the team</button>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }} onClick={() => onLog(r.id)} data-testid="slot-log-next">Log the result</button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Waiting list
// ---------------------------------------------------------------------------------------------
function WaitingTab({ list, releases, team, watchingAppts, onAdd, onEdit, onBook, onPack, onBringIn, onRemove, onCancel, onReopen }: {
  list: SlotRequest[]; releases: SlotRelease[]; team: TeamMember[]; watchingAppts: Appointment[];
  onAdd: () => void; onEdit: (r: SlotRequest) => void; onBook: (r: SlotRequest) => void; onPack: (r: SlotRequest) => void; onAlert?: () => void; onBringIn: () => void;
  onRemove: (r: SlotRequest) => void; onCancel: (r: SlotRequest) => void; onReopen: (r: SlotRequest) => void;
}) {
  const toast = useToast();
  const [show, setShow] = useState<'Waiting' | 'Booked' | 'All'>('Waiting');
  const [country, setCountry] = useState('');
  const [q, setQ] = useState('');
  const [staffId, setStaffId] = useState('');
  const ql = q.trim().toLowerCase();
  const t0 = today();
  const counts = { Waiting: list.filter(isWaiting).length, Booked: list.filter(r => r.status === 'Booked').length };
  const rows = sortWaiting(list.filter(r => (show === 'All' || (show === 'Waiting' ? r.status === 'Waiting' : r.status === 'Booked')) && (!country || r.country === country)
    && (!staffId || r.assignedTo === staffId)
    && (!ql || `${r.clientName} ${r.phone} ${r.note} ${r.centre} ${r.visaType || ''} ${r.purpose || ''} ${r.confirmationRef || ''}`.toLowerCase().includes(ql))));
  const countries = [...new Set(list.map(r => r.country))].sort();
  const urgent = list.filter(r => isWaiting(r) && r.priority === 'Urgent').length;
  const soonTravel = list.filter(r => isWaiting(r) && (daysToTravel(r, t0) ?? 999) <= 21).length;
  const nameOf = (id: string) => team.find(t => t.id === id)?.name || '';
  const releaseFor = (r: SlotRequest) => releases.find(x => x.active && countryMatches(x.country, r.country) && (!x.centre || !r.centre || x.centre.toLowerCase() === r.centre.toLowerCase())) || null;

  return (
    <div>
      <div className="grid gap-3.5 mb-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Waiting" value={counts.Waiting} hint="clients without a date yet" icon="appointments" testid="slot-stat-waiting" />
        <StatCard label="Urgent" value={urgent} hint="need the first dates" color="var(--red)" icon="complaints" testid="slot-stat-urgent" />
        <StatCard label="Travelling within 3 weeks" value={soonTravel} hint="check these first" color="var(--gold)" icon="attendance" />
        <StatCard label="Booked" value={counts.Booked} hint="have a date now" color="var(--green)" icon="appraisal" />
      </div>

      <Panel title="Waiting list" subtitle="Urgent first, then the earliest travel date" testid="slot-waiting-panel" flush
        action={<div className="flex gap-2 flex-wrap items-center">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, phone, note" style={{ width: 170 }} data-testid="slot-search" />
          <select value={staffId} onChange={e => setStaffId(e.target.value)} style={{ width: 140 }} data-testid="slot-staff-filter"><option value="">Everyone</option>{activeStaff(team).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: 150 }} data-testid="slot-country-filter"><option value="">All countries</option>{countries.map(c => <option key={c}>{c}</option>)}</select>
          {(['Waiting', 'Booked', 'All'] as const).map(s => <button key={s} className={`btn btn-sm ${show === s ? 'btn-primary' : ''}`} onClick={() => setShow(s)} data-testid={`slot-show-${s}`}>{s}{s !== 'All' ? ` (${counts[s]})` : ''}</button>)}
          {watchingAppts.length > 0 && <button className="btn btn-sm" onClick={onBringIn} data-testid="slot-bring-in" title="Clients marked “Watching for slot” in Appointments">Bring in {watchingAppts.length} from Appointments</button>}
          <button className="btn btn-sm" onClick={() => { if (!downloadCsv('slot-clients', casesReport(rows, team), CASE_COLUMNS)) toast('Nothing to download'); }} data-testid="slot-csv-cases" title="The clients in this view, without the booking-pack details">Download CSV</button>
          <button className="btn btn-sm btn-primary" onClick={onAdd} data-testid="slot-add">+ Add client</button>
        </div>}>
        {!rows.length ? (
          <div className="p-5"><EmptyState title={list.length ? 'Nobody in this view' : 'The waiting list is empty'} body="Add each client who needs an appointment, so the team knows who to look after first when new dates open." action={<button className="btn btn-primary" onClick={onAdd}>+ Add client</button>} /></div>
        ) : (
          <div className="overflow-auto">
            <table data-testid="slot-table">
              <thead><tr><th>Priority</th><th>Client</th><th>Where</th><th>People</th><th>Ready</th><th>Travel by</th><th>Looked after by</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map(r => {
                  const d = daysToTravel(r, t0);
                  const rel = releaseFor(r);
                  return (
                    <tr key={r.id} data-testid="slot-row" data-client={r.clientName} data-status={r.status}>
                      <td><Stamp text={r.priority} /></td>
                      <td className="font-medium">{r.clientName}<div className="font-mono-ui text-xs text-[var(--muted)]">{r.phone}</div>{(r.visaType || r.purpose) && <div className="text-[11.5px] text-[var(--muted)]" data-testid="slot-row-visa">{[r.visaType, r.purpose].filter(Boolean).join(' · ')}</div>}{r.note && <div className="text-[11.5px] text-[var(--muted)] italic">{r.note}</div>}</td>
                      <td>{r.country}{r.centre && <div className="text-[11.5px] text-[var(--muted)]">{r.centre}</div>}</td>
                      <td>{r.applicants}</td>
                      <td>{(() => { const rd = readiness(r); return <span className="chip" style={rd.label === 'Ready' ? TONE.good : rd.label === 'Almost ready' ? TONE.warn : TONE.neutral} data-testid="slot-ready-chip" title={rd.label}>{rd.done}/{rd.total}</span>; })()}</td>
                      <td className="whitespace-nowrap">{r.travelBy ? fmtDate(r.travelBy) : <span className="text-[var(--faint)]">—</span>}{d !== null && <div className="text-[11.5px]" style={{ color: d <= 14 ? 'var(--red)' : 'var(--muted)' }}>{d < 0 ? `${-d} days ago` : d === 0 ? 'today' : `in ${d} days`}</div>}{(r.dateFrom || r.dateTo) && <div className="text-[11.5px] text-[var(--muted)]" data-testid="slot-row-range">can accept {r.dateFrom ? fmtDate(r.dateFrom) : '…'} – {r.dateTo ? fmtDate(r.dateTo) : '…'}</div>}</td>
                      <td>{nameOf(r.assignedTo) || <span className="text-[var(--faint)]">—</span>}</td>
                      <td>
                        <Stamp text={r.status} />
                        {r.status === 'Booked' && <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{fmtDate(r.slotDate)}{r.slotTime ? ` · ${clock12(r.slotTime)}` : ''}<br />{r.bookedHow}{r.confirmationRef && <><br /><span data-testid="slot-row-ref">Ref {r.confirmationRef}</span></>}</div>}
                      </td>
                      <td>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {r.status === 'Waiting' && <a className="btn btn-sm" style={WA_BTN} target="_blank" rel="noreferrer" href={waUrl(r.phone, clientReadyMessage(r, rel))} data-testid="slot-ready-wa" title="Tell the client to be ready">Get ready</a>}
                          {r.status === 'Waiting' && <button className="btn btn-sm" onClick={() => onPack(r)} data-testid="slot-pack" title="Everything the booking form asks for, ready to copy">Booking pack</button>}
                          {r.status === 'Waiting' && <button className="btn btn-sm btn-primary" onClick={() => onBook(r)} data-testid="slot-mark-booked">Booked</button>}
                          {r.status === 'Booked' && <a className="btn btn-sm" style={WA_BTN} target="_blank" rel="noreferrer" href={waUrl(r.phone, clientBookedMessage(r))} data-testid="slot-booked-wa">Send date</a>}
                          <button className="btn btn-sm" onClick={() => onEdit(r)}>Edit</button>
                          {r.status === 'Waiting' ? <button className="btn btn-sm btn-ghost btn-danger" onClick={() => onCancel(r)}>Cancel</button> : <button className="btn btn-sm btn-ghost" onClick={() => onReopen(r)}>Reopen</button>}
                          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => { if (confirm(`Remove ${r.clientName} from the list?`)) onRemove(r); }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Release times and the rota
// ---------------------------------------------------------------------------------------------
function ReleasesTab({ releases, list, team, now, onAdd, onEdit, onLog, onToggle, onRemove }: {
  releases: SlotRelease[]; list: SlotRequest[]; team: TeamMember[]; now: number;
  onAdd: () => void; onEdit: (r: SlotRelease) => void; onLog: (id: string) => void; onToggle: (r: SlotRelease) => void; onRemove: (r: SlotRelease) => void;
}) {
  return (
    <div>
      <Callout tone="info" title="You enter the opening times — nothing here reads any website">
        Use the time your centre or consulate announced (usually on their official page or by notice). If it changes, edit it here. The countdown, rota messages and reminders all follow what you enter. Mark a time <b>Official notice</b> only when an official page announced it — anything else stays <b>Our estimate</b>.
      </Callout>
      <div className="flex justify-between items-center my-4 flex-wrap gap-2">
        <h2 className="font-display text-base font-semibold m-0">Release times <span className="text-xs font-normal text-[var(--muted)]">{releases.length} set up</span></h2>
        <button className="btn btn-primary" onClick={onAdd} data-testid="slot-add-release">+ Add opening time</button>
      </div>
      {!releases.length ? <EmptyState title="No opening times yet" body="Add one for each country and centre you book for." action={<button className="btn btn-primary" onClick={onAdd}>+ Add opening time</button>} /> : (
        <div className="grid gap-3.5 max-md:grid-cols-1" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {releases.map(r => {
            const n = nextOpening(r, now);
            const rota = r.rota.map(id => team.find(t => t.id === id)?.name).filter(Boolean) as string[];
            return (
              <section className="panel" key={r.id} data-testid="slot-release" data-label={r.label || r.country} style={{ opacity: r.active ? 1 : .6 }}>
                <div className="panel-body">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-display font-semibold text-[15.5px]" style={{ color: 'var(--accent-ink)' }}>{r.label || `${r.country} opening`}</div>
                      <div className="text-[12.5px] text-[var(--muted)]">{r.country}{r.centre ? ` · ${r.centre}` : ''}</div>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs" style={{ margin: 0 }}><input type="checkbox" checked={r.active} onChange={() => onToggle(r)} data-testid="slot-release-active" /> Active</label>
                  </div>
                  <div className="flex gap-2 flex-wrap mt-3">
                    <span className="chip">{dayLabel(r)}</span><span className="chip">{clock12(r.time)}</span>
                    <span className="chip" style={{ background: '#EAF6EF', color: '#0B6E4F' }}>{waitingFor(r, list).length} waiting</span>
                    <span className="chip" style={r.basis === 'Official notice' ? TONE.info : TONE.warn} data-testid="slot-release-basis">{r.basis === 'Official notice' ? 'Official notice' : 'Our estimate'}</span>
                  </div>
                  <div className="text-[12.5px] mt-3"><span className="text-[var(--muted)]">Next opening: </span><b>{n ? (n.state === 'open' ? 'open now' : `in ${countdown(n.msUntil)}`) : r.active ? 'none coming' : 'paused'}</b></div>
                  <div className="text-[12.5px] mt-1"><span className="text-[var(--muted)]">On duty: </span>{rota.length ? rota.join(', ') : <span className="text-[var(--faint)]">nobody yet</span>}</div>
                  {r.note && <div className="text-[12.5px] mt-2 italic text-[var(--muted)]">{r.note}</div>}
                  <div className="flex gap-1.5 mt-3.5 flex-wrap">
                    <button className="btn btn-sm btn-primary" onClick={() => onLog(r.id)}>Log a result</button>
                    <button className="btn btn-sm" onClick={() => onEdit(r)} data-testid="slot-edit-release">Edit</button>
                    <button className="btn btn-sm btn-ghost btn-danger" onClick={() => { if (confirm('Remove this opening time?')) onRemove(r); }}>Remove</button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------
function ResultsTab({ log, releases, team, onLog, onRemove }: { log: SlotAttempt[]; releases: SlotRelease[]; team: TeamMember[]; onLog: () => void; onRemove: (l: SlotAttempt) => void }) {
  const all = resultStats(log);
  const relName = (id: string) => { const r = releases.find(x => x.id === id); return r ? (r.label || `${r.country} opening`) : 'Removed opening'; };
  const by = (id: string) => team.find(t => t.id === id)?.name || id || '—';
  const rows = [...log].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  return (
    <div>
      <div className="grid gap-3.5 mb-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Openings tried" value={all.attempts} hint="results you have logged" icon="attendance" testid="slot-res-attempts" />
        <StatCard label="Times we got dates" value={all.got} hint="at least one slot booked" color="var(--green)" icon="appraisal" testid="slot-res-got" />
        <StatCard label="Success rate" value={all.hitRate === null ? '—' : `${all.hitRate}%`} hint="of the openings tried" color="var(--blue)" icon="dashboard" testid="slot-res-rate" />
        <StatCard label="Slots won" value={all.slots} hint={all.avgSlots ? `about ${all.avgSlots} each time we got dates` : 'none yet'} color="var(--gold)" icon="cases" testid="slot-res-slots" />
      </div>
      <div className="grid gap-4 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <Panel title="What happened at each opening" subtitle="Newest first" flush action={<button className="btn btn-sm btn-primary" onClick={onLog} data-testid="slot-add-result">+ Log a result</button>}>
          {!rows.length ? <div className="p-5"><EmptyState title="Nothing logged yet" body="After each opening, log whether you got dates. After a few weeks you will see which openings are worth the effort." /></div> : (
            <div className="overflow-auto"><table data-testid="slot-log-table">
              <thead><tr><th>Date</th><th>Time</th><th>Opening</th><th>Result</th><th>Slots</th><th>By</th><th>Note</th><th></th></tr></thead>
              <tbody>{rows.map(l => (
                <tr key={l.id} data-testid="slot-log-row" data-outcome={l.outcome}>
                  <td className="whitespace-nowrap">{fmtDate(l.date)}</td><td className="whitespace-nowrap">{l.time ? clock12(l.time) : '—'}</td><td>{relName(l.releaseId)}</td><td><Stamp text={l.outcome} /></td>
                  <td className="font-mono-ui">{l.outcome === 'Got slots' ? l.slotsGot : '—'}</td><td>{by(l.by)}</td><td className="text-[12.5px] text-[var(--muted)]">{l.note}</td>
                  <td><button className="btn btn-sm btn-ghost btn-danger" onClick={() => onRemove(l)}>Remove</button></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Panel>
        <Panel title="Which openings work" subtitle="Success rate for each">
          {releases.length ? <BarList valueFmt={n => `${n}%`} rows={releases.map(r => { const s = resultStats(log, r.id); return { label: r.label || `${r.country} opening`, value: s.hitRate ?? 0, note: s.attempts ? `${s.got} of ${s.attempts} tries` : 'not tried yet' }; })} /> : <div className="text-[13px] text-[var(--muted)]">Add an opening time first.</div>}
        </Panel>
      </div>
      <PatternPanel log={log} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Broker cost
// ---------------------------------------------------------------------------------------------
function CostTab({ list, month, setMonth }: { list: SlotRequest[]; month: string; setMonth: (m: string) => void }) {
  const cur = premiumStats(list, month);
  const trend = premiumByMonth(list, month, 6);
  const shift = (n: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); };
  const label = new Date(month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const mid = list.filter(r => r.status === 'Booked' && r.bookedHow === 'Paid middleman' && (r.bookedAt || '').slice(0, 7) === month).sort((a, b) => b.bookedAt.localeCompare(a.bookedAt));
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button className="btn" onClick={() => shift(-1)}>‹ Earlier</button>
        <div className="font-display text-xl font-semibold" style={{ color: 'var(--accent-ink)' }} data-testid="slot-cost-month">{label}</div>
        <button className="btn" onClick={() => shift(1)}>Later ›</button>
      </div>
      <div className="grid gap-3.5 mb-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Extra fees paid" value={money(cur.paid)} hint="on top of the normal fee, to middlemen" color="var(--red)" icon="payouts" testid="slot-cost-paid" />
        <StatCard label="Slots through middlemen" value={cur.viaMiddleman} hint={cur.average ? `about ${money(cur.average)} extra each` : 'none this month'} color="var(--gold)" icon="referralagents" testid="slot-cost-mid" />
        <StatCard label="Booked without extra fee" value={cur.byUs} hint="by the client or our team on the official site" color="var(--green)" icon="appraisal" testid="slot-cost-us" />
        <StatCard label="Saved by booking ourselves" value={money(cur.saved)} hint="at the average extra fee" color="var(--blue)" icon="profit" testid="slot-cost-saved" />
      </div>
      <div className="grid gap-4 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
        <Panel title="Extra fees, last 6 months" subtitle="Is the line coming down?">
          <BarList color="var(--red)" valueFmt={n => money(n)} rows={trend.map(t => ({ label: new Date(t.month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), value: t.paid, note: t.viaMiddleman ? `${t.viaMiddleman} slot${t.viaMiddleman === 1 ? '' : 's'}` : '' }))} />
        </Panel>
        <Panel title={`Bookings through middlemen — ${label}`} flush>
          {!mid.length ? <div className="p-5 text-[13px] text-[var(--muted)]">No middleman bookings this month.</div> : (
            <div className="overflow-auto"><table>
              <thead><tr><th>Booked on</th><th>Client</th><th>Country</th><th>Middleman</th><th style={{ textAlign: 'right' }}>Extra paid</th></tr></thead>
              <tbody>{mid.map(r => <tr key={r.id}><td>{fmtDate(r.bookedAt)}</td><td className="font-medium">{r.clientName}</td><td>{r.country}</td><td>{r.middleman || '—'}</td><td className="font-mono-ui" style={{ textAlign: 'right' }}>{money(r.premium)}</td></tr>)}</tbody>
            </table></div>
          )}
        </Panel>
      </div>
      <div className="mt-4"><Callout tone="warn" title="How this is counted">Only the <b>extra</b> amount you paid a middleman on top of the official fee is counted, and only for slots marked <b>Booked</b>. It is a tracker for your own decisions — it does not change any client’s case or the Finance screens. If you want it in the books, add it as an expense in Books &amp; Banks.</Callout></div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------------------------
function RequestForm({ req, onClose }: { req: SlotRequest | null; onClose: () => void }) {
  const { slotWaiting, setSlotWaiting, cases, team } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const [f, setF] = useState<SlotRequest>(req || blankReq());
  const [error, setError] = useState('');
  const set = <K extends keyof SlotRequest>(k: K, v: SlotRequest[K]) => { setError(''); setF(p => ({ ...p, [k]: v })); };
  const staff = activeStaff(team);
  const openCases = cases.filter(c => c.status === 'Active').sort((a, b) => a.name.localeCompare(b.name));
  const ticked = new Set(f.ready || []);
  const toggleReady = (item: string) => set('ready', ticked.has(item) ? (f.ready || []).filter(x => x !== item) : [...(f.ready || []), item]);

  function pickCase(id: string) {
    const c = cases.find(x => x.id === id);
    if (!c) { set('caseId', ''); return; }
    setF(p => ({ ...p, caseId: c.id, clientName: c.name, phone: c.phone, country: c.destination !== 'Schengen' && (DESTINATIONS as readonly string[]).includes(c.destination) ? c.destination : p.country, assignedTo: p.assignedTo || c.consultant || '' }));
  }
  function save() {
    if (!f.clientName.trim()) { toast('Enter the client’s name'); return; }
    if (!f.country) { toast('Choose the country'); return; }
    if (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo) { setError('“Can accept from” is later than “to”. Swap the dates.'); return; }
    const clean: SlotRequest = { ...f, clientName: f.clientName.trim(), applicants: Math.max(1, Number(f.applicants) || 1), purpose: (f.purpose || '').trim() };
    const dup = clean.status === 'Waiting' ? findDuplicateCase(slotWaiting, clean) : null;
    if (dup) { setError(`${dup.clientName} is already waiting for ${dup.country}${dup.centre ? ' · ' + dup.centre : ''}. Edit that entry instead of adding a second one.`); return; }
    if (req) { setSlotWaiting(prev => prev.map(x => x.id === req.id ? clean : x)); audit('Case', 'Edited a client', { country: clean.country, ref: clean.clientName }); toast('Saved'); }
    else { setSlotWaiting(prev => [...prev, clean]); audit('Case', 'Added to the waiting list', { country: clean.country, ref: clean.clientName, detail: clean.priority }); toast('Added to the waiting list'); }
    onClose();
  }
  return (
    <>
      <ModalTitle>{req ? 'Edit waiting-list entry' : 'Add a client to the waiting list'}</ModalTitle>
      {!req && openCases.length > 0 && (
        <Field label="Pick from an open case (fills the details below)">
          <select value={f.caseId} onChange={e => pickCase(e.target.value)} data-testid="slot-pick-case"><option value="">— or type the details yourself —</option>{openCases.map(c => <option key={c.id} value={c.id}>{c.name} · {c.destination}</option>)}</select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field label="Client name"><input value={f.clientName} onChange={e => set('clientName', e.target.value)} data-testid="slot-f-name" /></Field>
        <Field label="Phone / WhatsApp"><input value={f.phone} onChange={e => set('phone', e.target.value)} data-testid="slot-f-phone" /></Field>
        <Field label="Country"><select value={f.country} onChange={e => set('country', e.target.value)} data-testid="slot-f-country">{SLOT_COUNTRIES.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Centre / city"><input value={f.centre} onChange={e => set('centre', e.target.value)} placeholder="e.g. Islamabad" data-testid="slot-f-centre" /></Field>
        <Field label="Number of applicants"><input type="number" min={1} value={f.applicants} onChange={e => set('applicants', Number(e.target.value))} /></Field>
        <Field label="Must travel by (if known)"><input type="date" value={f.travelBy} onChange={e => set('travelBy', e.target.value)} data-testid="slot-f-travel" /></Field>
        <Field label="Visa type"><select value={f.visaType || ''} onChange={e => set('visaType', e.target.value)} data-testid="slot-f-visatype"><option value="">—</option>{VISA_TYPES.map(v => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Why they travel (one line)"><input value={f.purpose || ''} onChange={e => set('purpose', e.target.value)} placeholder="e.g. cousin’s wedding in Brussels" data-testid="slot-f-purpose" /></Field>
        <Field label="Can accept dates from"><input type="date" value={f.dateFrom || ''} onChange={e => set('dateFrom', e.target.value)} data-testid="slot-f-from" /></Field>
        <Field label="…to"><input type="date" value={f.dateTo || ''} onChange={e => set('dateTo', e.target.value)} data-testid="slot-f-to" /></Field>
        <Field label="Priority"><select value={f.priority} onChange={e => set('priority', e.target.value as SlotRequest['priority'])} data-testid="slot-f-priority"><option>Urgent</option><option>Normal</option><option>Flexible</option></select></Field>
        <Field label="Looked after by"><select value={f.assignedTo} onChange={e => set('assignedTo', e.target.value)}><option value="">— nobody yet —</option>{staff.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      </div>
      <Field label={`Is the client ready? (${readiness(f).done} of ${READINESS_ITEMS.length})`}>
        <div className="grid grid-cols-2 gap-x-3 max-sm:grid-cols-1" data-testid="slot-f-readiness">
          {READINESS_ITEMS.map(item => <label key={item} className="flex items-center gap-2 text-[13px] py-0.5" style={{ margin: 0 }}><input type="checkbox" checked={ticked.has(item)} onChange={() => toggleReady(item)} data-testid="slot-f-ready" /> {item}</label>)}
        </div>
      </Field>
      <Field label="Note"><textarea rows={2} value={f.note} onChange={e => set('note', e.target.value)} placeholder="Anything the team should know — e.g. only mornings, passport expires soon" /></Field>
      {error && <div className="mb-2"><Callout tone="bad"><span data-testid="slot-f-error">{error}</span></Callout></div>}
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} data-testid="slot-f-save">{req ? 'Save changes' : 'Add to list'}</button></ModalFoot>
    </>
  );
}

function BookedForm({ req, onClose }: { req: SlotRequest; onClose: () => void }) {
  const { setSlotWaiting, setAppointments, appointments } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const [ref, setRef] = useState(req.confirmationRef || '');
  const [slotDate, setSlotDate] = useState(req.slotDate || addDaysIso(today(), 14));
  const [slotTime, setSlotTime] = useState(req.slotTime || '10:00');
  const [how, setHow] = useState<SlotHow>(req.bookedHow || 'Client booked, we guided');
  const [middleman, setMiddleman] = useState(req.middleman || '');
  const [premium, setPremium] = useState(req.premium ? String(req.premium) : '');
  function save() {
    if (!slotDate) { toast('Enter the appointment date'); return; }
    if (how === 'Paid middleman' && !(Number(premium) >= 0 && premium !== '')) { toast('Enter the extra amount you paid (0 if none)'); return; }
    const extra = how === 'Paid middleman' ? Math.max(0, Math.round(Number(premium))) : 0;
    const updated: SlotRequest = { ...req, status: 'Booked', slotDate, slotTime, bookedHow: how, middleman: how === 'Paid middleman' ? middleman.trim() : '', premium: extra, bookedAt: today(), confirmationRef: ref.trim() };
    // put it in the Appointments calendar: update the one we came from, or create a new one
    const existing = req.apptId ? appointments.find(a => a.id === req.apptId) : undefined;
    let apptId = req.apptId;
    if (existing) setAppointments(prev => prev.map(a => a.id === existing.id ? { ...a, date: slotDate, time: slotTime, status: 'Scheduled', portal: a.portal || req.centre } : a));
    else { apptId = genId('ap'); setAppointments(prev => [...prev, { id: apptId, clientName: req.clientName, phone: req.phone, date: slotDate, time: slotTime, type: `${req.country} visa appointment`, portal: req.centre || req.country, consultant: req.assignedTo, status: 'Scheduled' }]); }
    setSlotWaiting(prev => prev.map(x => x.id === req.id ? { ...updated, apptId } : x));
    audit('Case', 'Marked booked', { country: req.country, ref: req.clientName, detail: `${slotDate} · ${how}${ref.trim() ? ' · reference saved' : ''}` });
    toast('Marked booked — it is now in Appointments');
    onClose();
  }
  return (
    <>
      <ModalTitle>Appointment booked — {req.clientName}</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Appointment date"><input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} data-testid="slot-b-date" /></Field>
        <Field label="Time"><input type="time" value={slotTime} onChange={e => setSlotTime(e.target.value)} data-testid="slot-b-time" /></Field>
      </div>
      <Field label="Official confirmation / reference number (from the email or SMS)"><input value={ref} onChange={e => setRef(e.target.value)} placeholder="Copy it from the provider’s confirmation" data-testid="slot-b-ref" /></Field>
      <Field label="How was it booked?"><select value={how} onChange={e => setHow(e.target.value as SlotHow)} data-testid="slot-b-how">{HOW_BOOKED.map(h => <option key={h}>{h}</option>)}</select></Field>
      {how === 'Paid middleman' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Middleman’s name"><input value={middleman} onChange={e => setMiddleman(e.target.value)} data-testid="slot-b-mid" /></Field>
          <Field label="Extra amount paid (PKR)"><input type="number" min={0} value={premium} onChange={e => setPremium(e.target.value)} placeholder="only the extra, e.g. 12000" data-testid="slot-b-premium" /></Field>
        </div>
      )}
      <div className="text-[12px] text-[var(--muted)] mb-1">The appointment is added to the Appointments calendar as “Scheduled”.</div>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} data-testid="slot-b-save">Save</button></ModalFoot>
    </>
  );
}

function ReleaseForm({ rel, onClose }: { rel: SlotRelease | null; onClose: () => void }) {
  const { setSlotReleases, team } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const [f, setF] = useState<SlotRelease>(rel || { id: genId('sr'), country: 'Spain', centre: '', label: '', time: '15:00', days: [1, 2, 3, 4, 5], oneOffDate: '', rota: [], note: '', active: true, basis: 'Our estimate', sourceUrl: '' });
  const [oneOff, setOneOff] = useState(!!rel?.oneOffDate);
  const set = <K extends keyof SlotRelease>(k: K, v: SlotRelease[K]) => setF(p => ({ ...p, [k]: v }));
  const staff = activeStaff(team);
  const toggleDay = (d: number) => set('days', f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d]);
  const toggleRota = (id: string) => set('rota', f.rota.includes(id) ? f.rota.filter(x => x !== id) : [...f.rota, id]);
  function save() {
    if (!/^\d{1,2}:\d{2}$/.test(f.time)) { toast('Enter the opening time'); return; }
    if (oneOff ? !f.oneOffDate : !f.days.length) { toast(oneOff ? 'Choose the date' : 'Choose at least one day'); return; }
    const official = f.basis === 'Official notice';
    if (official && !/^https?:\/\/\S+\.\S+/i.test((f.sourceUrl || '').trim())) { toast('An official notice needs the link to the official page'); return; }
    const clean: SlotRelease = { ...f, oneOffDate: oneOff ? f.oneOffDate : '', days: oneOff ? [] : f.days, label: f.label.trim(), basis: official ? 'Official notice' : 'Our estimate', sourceUrl: official ? (f.sourceUrl || '').trim() : '' };
    const name = clean.label || `${clean.country} opening`;
    if (rel) { setSlotReleases(prev => prev.map(x => x.id === rel.id ? clean : x)); audit('Release', 'Edited an opening time', { country: clean.country, ref: name, detail: clean.basis }); toast('Saved'); }
    else { setSlotReleases(prev => [...prev, clean]); audit('Release', 'Added an opening time', { country: clean.country, ref: name, detail: clean.basis }); toast('Opening time added'); }
    onClose();
  }
  return (
    <>
      <ModalTitle>{rel ? 'Edit opening time' : 'Add an opening time'}</ModalTitle>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field label="Country"><select value={f.country} onChange={e => set('country', e.target.value)} data-testid="slot-r-country">{SLOT_COUNTRIES.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Centre / city"><input value={f.centre} onChange={e => set('centre', e.target.value)} placeholder="e.g. Islamabad" data-testid="slot-r-centre" /></Field>
        <Field label="Name for this opening"><input value={f.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Spain — new dates" data-testid="slot-r-label" /></Field>
        <Field label="Opening time (Pakistan time)"><input type="time" value={f.time} onChange={e => set('time', e.target.value)} data-testid="slot-r-time" /></Field>
      </div>
      <Field label="When does it open?">
        <div className="flex gap-2 mb-2">
          <button className={`btn btn-sm ${!oneOff ? 'btn-primary' : ''}`} onClick={() => setOneOff(false)}>Every week</button>
          <button className={`btn btn-sm ${oneOff ? 'btn-primary' : ''}`} onClick={() => setOneOff(true)} data-testid="slot-r-oneoff">One date only</button>
        </div>
        {oneOff ? <input type="date" value={f.oneOffDate} onChange={e => set('oneOffDate', e.target.value)} data-testid="slot-r-date" /> : (
          <div className="flex gap-1.5 flex-wrap">{[1, 2, 3, 4, 5, 6, 0].map(d => <button key={d} className={`btn btn-sm ${f.days.includes(d) ? 'btn-primary' : ''}`} onClick={() => toggleDay(d)} data-testid={`slot-r-day-${d}`}>{DAY_NAMES[d]}</button>)}</div>
        )}
      </Field>
      <Field label="Where does this time come from?">
        <select value={f.basis || 'Our estimate'} onChange={e => set('basis', e.target.value as SlotRelease['basis'])} data-testid="slot-r-basis"><option value="Our estimate">Our own estimate (not announced)</option><option value="Official notice">An official notice</option></select>
        {f.basis === 'Official notice' && <input className="mt-2" value={f.sourceUrl || ''} onChange={e => set('sourceUrl', e.target.value)} placeholder="https:// link to the official page" data-testid="slot-r-url" />}
      </Field>
      <Field label="Who is on duty at that time?">
        <div className="flex gap-1.5 flex-wrap" data-testid="slot-r-rota">{staff.map(t => <button key={t.id} className={`btn btn-sm ${f.rota.includes(t.id) ? 'btn-primary' : ''}`} onClick={() => toggleRota(t.id)} data-testid="slot-r-person">{t.name}</button>)}</div>
      </Field>
      <Field label="Note"><textarea rows={2} value={f.note} onChange={e => set('note', e.target.value)} placeholder="Where the announcement came from, anything the team should remember" /></Field>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} data-testid="slot-r-save">{rel ? 'Save changes' : 'Add opening time'}</button></ModalFoot>
    </>
  );
}

function LogForm({ releaseId, onClose }: { releaseId: string; onClose: () => void }) {
  const { slotReleases, setSlotLog, team } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const [rid, setRid] = useState(releaseId || slotReleases[0]?.id || '');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(() => { const d = new Date(Date.now() + 5 * 3600 * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; });
  const [outcome, setOutcome] = useState<SlotAttempt['outcome']>('Got slots');
  const [slots, setSlots] = useState('1');
  const [by, setBy] = useState('');
  const [note, setNote] = useState('');
  function save() {
    if (!rid) { toast('Add an opening time first'); return; }
    const n = outcome === 'Got slots' ? Math.max(1, Math.round(Number(slots) || 1)) : 0;
    setSlotLog(prev => [...prev, { id: genId('sl'), releaseId: rid, date, time, outcome, slotsGot: n, by, note: note.trim() }]);
    const rl = slotReleases.find(x => x.id === rid);
    audit('Result', 'Logged a result', { country: rl?.country, ref: rl ? (rl.label || `${rl.country} opening`) : '', detail: `${outcome}${outcome === 'Got slots' ? ` · ${n}` : ''}` });
    toast('Result logged'); onClose();
  }
  return (
    <>
      <ModalTitle>Log what happened</ModalTitle>
      <Field label="Which opening?"><select value={rid} onChange={e => setRid(e.target.value)} data-testid="slot-l-release">{!slotReleases.length && <option value="">— no opening times yet —</option>}{slotReleases.map(r => <option key={r.id} value={r.id}>{r.label || `${r.country} opening`}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="slot-l-date" /></Field>
        <Field label="Time it was checked (Pakistan time)"><input type="time" value={time} onChange={e => setTime(e.target.value)} data-testid="slot-l-time" /></Field>
        <Field label="Result"><select value={outcome} onChange={e => setOutcome(e.target.value as SlotAttempt['outcome'])} data-testid="slot-l-outcome"><option>Got slots</option><option>Not open</option><option>Missed</option></select></Field>
      </div>
      {outcome === 'Got slots' && <Field label="How many slots did we get?"><input type="number" min={1} value={slots} onChange={e => setSlots(e.target.value)} data-testid="slot-l-count" /></Field>}
      <Field label="Done by"><select value={by} onChange={e => setBy(e.target.value)}><option value="">—</option>{activeStaff(team).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Field label="Note"><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. site was slow, opened 10 minutes late" /></Field>
      <ModalFoot><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} data-testid="slot-l-save">Save result</button></ModalFoot>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Booking pack — everything the booking form asks for, one tap to copy each line
// ---------------------------------------------------------------------------------------------
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
const READY = ['Passport scan open on the screen', 'Phone with the SMS code beside you', 'Email inbox open', 'Payment card or method ready', 'Client has said “yes, book it”'];

function PackForm({ req, onClose }: { req: SlotRequest; onClose: () => void }) {
  const { cases, setSlotWaiting } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const [details, setDetails] = useState(req.details || '');
  const [done, setDone] = useState<Record<number, boolean>>({});
  const family = (cases.find(c => c.id === req.caseId)?.familyMembers) || [];
  const view: SlotRequest = { ...req, details };
  const lines = packLines(view, family);
  async function copy(v: string, what: string) { toast((await copyText(v)) ? `${what} copied` : 'Could not copy — select the text and press Ctrl+C'); }
  function save() { setSlotWaiting(prev => prev.map(x => x.id === req.id ? { ...x, details: details.trim() } : x)); audit('Case', 'Saved booking-pack details', { country: req.country, ref: req.clientName }); toast('Details saved'); }
  return (
    <>
      <ModalTitle>Booking pack — {req.clientName}</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3">Keep this open next to the official booking page. Tap <b>Copy</b> beside a line and paste it into the form — you type nothing twice. You still do the booking yourself on the official site.</div>
      <div className="grid gap-4 max-md:grid-cols-1" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div data-testid="slot-pack-lines">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid var(--line)' }} data-testid="slot-pack-line">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{l.label || 'Detail'}</div>
                <div className="font-mono-ui text-[13.5px] break-all">{l.value}</div>
              </div>
              <button className="btn btn-sm" onClick={() => copy(l.value, l.label || 'Detail')} data-testid="slot-pack-copy">Copy</button>
            </div>
          ))}
          <div className="mt-3"><button className="btn btn-sm" onClick={() => copy(packText(view, family), 'Whole pack')} data-testid="slot-pack-copyall">Copy everything</button></div>
        </div>
        <div>
          <Field label="Extra details the form asks for (one per line)">
            <textarea rows={6} value={details} onChange={e => setDetails(e.target.value)} placeholder={'Passport no: AB1234567\nEmail: client@example.com\nDate of birth: 1990-05-14'} data-testid="slot-pack-details" />
          </Field>
          <button className="btn btn-sm btn-primary" onClick={save} data-testid="slot-pack-save">Save details</button>
          <div className="text-[11.5px] text-[var(--muted)] mt-1.5">Only the Head Manager and admins can see this screen.</div>
          <div className="mt-4 text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">Before the opening</div>
          {READY.map((t, i) => <label key={i} className="flex items-center gap-2 text-[13px] py-0.5" style={{ margin: 0 }}><input type="checkbox" checked={!!done[i]} onChange={e => setDone(p => ({ ...p, [i]: e.target.checked }))} data-testid="slot-pack-check" /> {t}</label>)}
        </div>
      </div>
      <ModalFoot><button className="btn" onClick={onClose}>Close</button></ModalFoot>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// "Slots just opened" — one message to the whole team, any hour
// ---------------------------------------------------------------------------------------------
function AlertForm({ soon, alert, onClose }: { soon: ReturnType<typeof soonestOpening>; alert: SlotAlert | null; onClose: () => void }) {
  const { slotWaiting, slotReleases, slotNotices, setSlotNotices, slotConfig, team } = useAppData();
  const toast = useToast();
  const audit = useAudit();
  const who = useWho();
  const [country, setCountry] = useState(alert?.country || soon?.release.country || slotWaiting.find(isWaiting)?.country || 'Spain');
  const [centre, setCentre] = useState(alert ? alert.centre : soon?.release.centre || '');
  const rel = slotReleases.find(r => countryMatches(r.country, country) && (!r.centre || !centre || r.centre.toLowerCase() === centre.toLowerCase()));
  const clients = sortWaiting(slotWaiting.filter(x => isWaiting(x) && countryMatches(x.country, country) && (!centre || !x.centre || x.centre.toLowerCase() === centre.toLowerCase())));
  const [msg, setMsg] = useState('');
  const [edited, setEdited] = useState(false);
  const auto = alert ? alertTeamMessage(alert) : alertMessage(country, centre, clients);
  const text = edited ? msg : auto;
  const topic = topicFor(alert?.id || '', country, centre, Date.now());
  const rota = new Set(rel?.rota || soon?.release.rota || []);
  const first = new Set(configFor(slotConfig, country).notify);
  const people = activeStaff(team).filter(t => t.phone).sort((a, b) => Number(first.has(b.id)) - Number(first.has(a.id)) || Number(rota.has(b.id)) - Number(rota.has(a.id)) || a.name.localeCompare(b.name));

  // Opening WhatsApp is all the portal can do; it writes that down, and staff say whether it went.
  function opened(m: TeamMember) {
    const st = sendState(slotNotices, m.id, topic);
    setSlotNotices(prev => [...prev, { id: genId('sn'), alertId: alert?.id || '', topic, to: m.id, toName: m.name, channel: 'WhatsApp', status: 'Opened', attempt: st.attempts + 1, at: new Date().toISOString(), by: who }]);
    audit('Notice', 'Opened a WhatsApp alert', { country, ref: m.name, detail: `try ${st.attempts + 1} of ${MAX_ATTEMPTS}${alert ? ' · ' + CATEGORY_INFO[alert.category].short : ''}` });
  }
  function mark(noticeId: string, name: string, status: 'Sent' | 'Failed') {
    setSlotNotices(prev => prev.map(n => n.id === noticeId ? { ...n, status } : n));
    audit('Notice', status === 'Sent' ? 'Confirmed an alert was sent' : 'Marked an alert as failed', { country, ref: name });
  }
  return (
    <>
      <ModalTitle>{alert ? `Alert the team — ${CATEGORY_INFO[alert.category].short}` : 'Slots just opened — alert the team'}</ModalTitle>
      <div className="text-[12.5px] text-[var(--muted)] mb-3">Pick the country, check the message, then tap each person (or copy it into your team’s WhatsApp group). Nothing is sent by the portal itself — it opens WhatsApp for you, writes that down, and you confirm whether it went. Each person is told once; a failed try can be repeated up to {MAX_ATTEMPTS} times.</div>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field label="Country"><select value={country} disabled={!!alert} onChange={e => { setCountry(e.target.value); setEdited(false); }} data-testid="slot-al-country">{SLOT_COUNTRIES.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Centre / city"><input value={centre} disabled={!!alert} onChange={e => { setCentre(e.target.value); setEdited(false); }} placeholder="e.g. Islamabad" data-testid="slot-al-centre" /></Field>
      </div>
      <Field label={alert ? 'Message — worded so it claims no more than the alert does' : `Message — ${clients.length} client${clients.length === 1 ? '' : 's'} waiting for this country`}>
        <textarea rows={8} value={text} onChange={e => { setMsg(e.target.value); setEdited(true); }} data-testid="slot-al-text" />
      </Field>
      <div className="flex gap-2 flex-wrap mb-3">
        <button className="btn btn-sm" onClick={async () => toast((await copyText(text)) ? 'Message copied — paste it into your team group' : 'Could not copy — select the text and press Ctrl+C')} data-testid="slot-al-copy">Copy message</button>
      </div>
      <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">Message one by one</div>
      <div className="flex gap-2 flex-wrap" data-testid="slot-al-people">
        {people.map(m => {
          const st = sendState(slotNotices, m.id, topic);
          return (
            <span key={m.id} className="inline-flex items-center gap-1" data-testid="slot-al-person" data-name={m.name} data-state={st.state}>
              {st.state === 'sent' ? <span className="btn btn-sm" style={{ opacity: .75, cursor: 'default' }} data-testid="slot-al-done">✓ {m.name} — sent {fmtPkt(st.last!.at)}</span>
                : st.state === 'limit' ? <span className="btn btn-sm" style={{ opacity: .75, cursor: 'default' }} data-testid="slot-al-limit">{m.name} — {MAX_ATTEMPTS} tries used, phone them</span>
                : <a className="btn btn-sm" style={WA_BTN} target="_blank" rel="noreferrer" href={waUrl(m.phone, text)} onClick={() => opened(m)} data-testid="slot-al-wa" title={`WhatsApp ${m.name}`}>
                  {m.name}{first.has(m.id) ? ' · alerted first' : rota.has(m.id) ? ' · on duty' : ''}{st.state !== 'new' ? ` · try ${st.attempts + 1} of ${MAX_ATTEMPTS}` : ''}
                </a>}
              {st.state === 'opened' && st.last && <>
                <button className="btn btn-sm" onClick={() => mark(st.last!.id, m.name, 'Sent')} data-testid="slot-al-marksent">Sent ✓</button>
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => mark(st.last!.id, m.name, 'Failed')} data-testid="slot-al-markfailed">Did not go</button>
              </>}
            </span>
          );
        })}
        {!people.length && <span className="text-[13px] text-[var(--muted)]">No team phone numbers on file — add them in HR, or copy the message above.</span>}
      </div>
      <ModalFoot><button className="btn" onClick={onClose}>Close</button></ModalFoot>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// When do dates really appear?
// ---------------------------------------------------------------------------------------------
function PatternPanel({ log }: { log: SlotAttempt[] }) {
  const p = openingPattern(log);
  return (
    <div className="mt-4" data-testid="slot-pattern">
      <Panel title="When do dates really appear?" subtitle="A pattern from past results — an estimate, never an announcement. The more you log, the clearer it gets.">
        {!p.enough ? (
          <div className="text-[13px] text-[var(--muted)]" data-testid="slot-pattern-empty">
            {p.total} result{p.total === 1 ? '' : 's'} logged so far. Log at least 5 — with the time you checked — and this shows the best days and hours to put your team on duty.
          </div>
        ) : (
          <>
            {(p.bestWindow || p.bestDay) ? (
              <Callout tone="info" title="What the results say so far">
                <span data-testid="slot-pattern-best">{p.bestWindow ? <>Dates appeared most in the <b>{p.bestWindow.label}</b> window ({p.bestWindow.got} of {p.bestWindow.tries} checks got dates).</> : null}{p.bestWindow && p.bestDay ? ' ' : ''}{p.bestDay ? <>The best day so far is <b>{p.bestDay.label}</b> ({p.bestDay.got} of {p.bestDay.tries}).</> : null}</span>
                {p.timed < p.total && <div className="text-[12.5px] mt-1">{p.total - p.timed} result{p.total - p.timed === 1 ? ' has' : 's have'} no time logged and {p.total - p.timed === 1 ? 'is' : 'are'} left out of the hours chart.</div>}
              </Callout>
            ) : <div className="text-[13px] text-[var(--muted)] mb-2">No dates have been found yet, so there is no pattern to show. Keep logging.</div>}
            <div className="grid gap-4 mt-3 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
              <div data-testid="slot-pattern-days"><div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">By day</div>
                <BarList rows={p.days.map(d => ({ label: d.label, value: d.got, note: d.tries ? `${d.tries} check${d.tries === 1 ? '' : 's'}` : '' }))} valueFmt={n => `${n} got dates`} /></div>
              <div data-testid="slot-pattern-windows"><div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">By time of day (Pakistan time)</div>
                <BarList rows={p.windows.map(d => ({ label: d.label, value: d.got, note: d.tries ? `${d.tries} check${d.tries === 1 ? '' : 's'}` : '' }))} valueFmt={n => `${n} got dates`} /></div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Live booking — the board for the moment dates open
// ---------------------------------------------------------------------------------------------
function LiveTab({ list, setList, soon, who, onBook, onPack, onAlert, start }: {
  start?: { country: string; centre: string } | null;
  list: SlotRequest[]; setList: (fn: (prev: SlotRequest[]) => SlotRequest[]) => void; soon: ReturnType<typeof soonestOpening>; who: string;
  onBook: (r: SlotRequest) => void; onPack: (r: SlotRequest) => void; onAlert: () => void;
}) {
  const { team } = useAppData();
  const toast = useToast();
  const [country, setCountry] = useState(start?.country || soon?.release.country || list.find(isWaiting)?.country || 'Spain');
  const [centre, setCentre] = useState(start ? start.centre : soon?.release.centre || '');
  const board = liveBoard(list, country, centre, today());
  const c = liveCounts(board);
  const patch = (id: string, p: Partial<SlotRequest>) => setList(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
  const nameOf = (id: string) => team.find(t => t.id === id)?.name || '';
  const take = (r: SlotRequest, live: SlotLive) => patch(r.id, { live, liveBy: live ? who : '' });
  const reset = () => { const ids = new Set(board.filter(x => x.status === 'Waiting').map(x => x.id)); setList(prev => prev.map(x => ids.has(x.id) ? liveReset(x) : x)); toast('Board reset — everyone is Ready again'); };
  return (
    <div data-testid="slot-live">
      <Callout tone="info" title="How to use this when dates open">
        Work down the list from the top. <b>Call</b> or send the <b>WhatsApp</b> to the first ready client, stay with them while <b>they</b> log in and book in their own name, then press <b>Booked</b> and enter the date. Press <b>No slot</b> if the dates ran out. The board updates for everyone on the team.
      </Callout>
      <div className="grid gap-3.5 my-4 max-md:grid-cols-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard label="Ready" value={c.ready} hint="not yet called" testid="slot-live-ready" />
        <StatCard label="On the phone" value={c.calling} hint="being called now" color="var(--gold)" testid="slot-live-calling" />
        <StatCard label="Booking now" value={c.booking} hint="logged in, booking" color="var(--blue)" testid="slot-live-booking" />
        <StatCard label="Booked today" value={c.booked} hint="have a date" color="var(--green)" testid="slot-live-booked" />
        <StatCard label="No slot" value={c.noSlot} hint="dates ran out" color="var(--red)" testid="slot-live-noslot" />
      </div>
      <Panel title="Live board" subtitle="Urgent clients first, then the earliest travel date" flush testid="slot-live-panel"
        action={<div className="flex gap-2 flex-wrap items-center">
          <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: 150 }} data-testid="slot-live-country">{SLOT_COUNTRIES.map(d => <option key={d}>{d}</option>)}</select>
          <input value={centre} onChange={e => setCentre(e.target.value)} placeholder="Centre / city" style={{ width: 140 }} data-testid="slot-live-centre" />
          <button className="btn btn-sm" onClick={onAlert} data-testid="slot-live-alert">Alert the team</button>
          <button className="btn btn-sm btn-ghost" onClick={reset} data-testid="slot-live-reset">Reset board</button>
        </div>}>
        {!board.length ? (
          <div className="p-5"><EmptyState title={`Nobody is waiting for ${country}${centre ? ' ' + centre : ''}`} body="Add clients on the Waiting list tab, or choose another country above." /></div>
        ) : (
          <div className="overflow-auto">
            <table data-testid="slot-live-table">
              <thead><tr><th>#</th><th>Client</th><th>Status</th><th>With</th><th></th></tr></thead>
              <tbody>
                {board.map((r, i) => {
                  const st = liveLabel(r);
                  return (
                    <tr key={r.id} data-testid="slot-live-row" data-client={r.clientName} data-live={st}>
                      <td className="font-mono-ui text-[var(--muted)]">{i + 1}</td>
                      <td className="font-medium">{r.clientName}{r.priority === 'Urgent' && <span className="ml-2 align-middle"><Stamp text="Urgent" /></span>}
                        <div className="font-mono-ui text-xs text-[var(--muted)]">{r.phone}{r.travelBy ? ` · travels by ${fmtDate(r.travelBy)}` : ''}</div></td>
                      <td><span className="chip" style={st === 'Booked' ? { background: '#EAF6EF', color: '#0B6E4F' } : st === 'No slot' ? { background: '#FDECEC', color: '#B42318' } : st === 'Ready' ? undefined : { background: '#FFF6E0', color: '#8A5A00' }}>{st}</span></td>
                      <td className="text-[13px]">{r.liveBy || nameOf(r.assignedTo) || <span className="text-[var(--faint)]">—</span>}</td>
                      <td>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {st === 'Ready' && <>
                            <a className="btn btn-sm btn-primary" href={`tel:${r.phone}`} onClick={() => take(r, 'Calling')} data-testid="slot-live-call">Call</a>
                            <a className="btn btn-sm" style={WA_BTN} target="_blank" rel="noreferrer" href={waUrl(r.phone, joinNowMessage(r, who))} onClick={() => take(r, 'Calling')} data-testid="slot-live-join">WhatsApp</a>
                          </>}
                          {st === 'On the phone' && <button className="btn btn-sm btn-primary" onClick={() => take(r, 'Booking')} data-testid="slot-live-start">They are booking</button>}
                          {(st === 'On the phone' || st === 'Booking now') && <button className="btn btn-sm" onClick={() => onBook(r)} data-testid="slot-live-booked-btn">Booked ✓</button>}
                          {st === 'Booking now' && <button className="btn btn-sm btn-ghost btn-danger" onClick={() => take(r, 'No slot')} data-testid="slot-live-noslot-btn">No slot</button>}
                          {(st === 'On the phone' || st === 'Booking now' || st === 'No slot') && <button className="btn btn-sm btn-ghost" onClick={() => take(r, '')} data-testid="slot-live-back">{st === 'No slot' ? 'Try again' : 'Back to ready'}</button>}
                          {st === 'Booked' && <a className="btn btn-sm" style={WA_BTN} target="_blank" rel="noreferrer" href={waUrl(r.phone, clientBookedMessage(r))} data-testid="slot-live-senddate">Send date</a>}
                          {st !== 'Booked' && <button className="btn btn-sm" onClick={() => onPack(r)} data-testid="slot-live-pack">Pack</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Where to book
// ---------------------------------------------------------------------------------------------
function GuideTab() {
  const [pick, setPick] = useState<string>('Spain');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const g = SLOT_GUIDES.find(x => x.country === pick);
  const covered = SLOT_GUIDES.map(x => x.country);
  const others = ['Austria', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Sweden', 'Switzerland'].filter(c => !covered.includes(c));
  const chip = (st: string) => st === 'Checked on an official page' ? { background: '#EAF6EF', color: '#0B6E4F' } : st === 'Partly checked' ? { background: '#FFF6E0', color: '#8A5A00' } : { background: '#F1F1F1', color: '#555' };
  return (
    <div data-testid="slot-guide">
      <Callout tone="warn" title={`Checked on ${GUIDES_CHECKED_ON}`}>
        These cards come from the official embassy and provider pages and from news reports. Rules change often — confirm on the official page, and put the questions at the bottom to the provider in writing, before you promise a client anything.
      </Callout>
      <div className="flex gap-2 flex-wrap my-4" data-testid="slot-guide-chips">
        {SLOT_GUIDES.map(x => <button key={x.country} className={`btn btn-sm ${pick === x.country ? 'btn-primary' : ''}`} onClick={() => setPick(x.country)} data-testid="slot-guide-chip">{x.country}{PRIORITY_COUNTRIES.includes(x.country) ? ' ★' : ''}</button>)}
        <button className={`btn btn-sm ${pick === 'Other' ? 'btn-primary' : ''}`} onClick={() => setPick('Other')} data-testid="slot-guide-chip">Other Schengen countries</button>
      </div>
      {g ? (
        <Panel title={`${g.country} — ${g.provider}`} subtitle={`Centres: ${g.centres}`} testid="slot-guide-card"
          action={<span className="chip" style={chip(g.status)} data-testid="slot-guide-status">{g.status}</span>}>
          {g.warning && <div className="mb-3"><Callout tone="warn" title="Check this first"><span data-testid="slot-guide-warning">{g.warning}</span></Callout></div>}
          <div className="grid gap-5 max-lg:grid-cols-1" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">How booking works</div>
              <ol className="pl-5 m-0 text-[13.5px]" style={{ listStyle: 'decimal' }}>{g.steps.map((t, i) => <li key={i} className="mb-1.5">{t}</li>)}</ol>
              <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mt-4 mb-1.5">Rules to know</div>
              <ul className="pl-5 m-0 text-[13.5px]" style={{ listStyle: 'disc' }}>{g.rules.map((t, i) => <li key={i} className="mb-1.5">{t}</li>)}</ul>
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">Ask the provider in writing</div>
              {g.ask.map((q, i) => <label key={i} className="flex items-start gap-2 text-[13px] py-0.5" style={{ margin: 0 }}><input type="checkbox" className="mt-0.5" checked={!!done[`${g.country}:${i}`]} onChange={e => setDone(p => ({ ...p, [`${g.country}:${i}`]: e.target.checked }))} data-testid="slot-guide-ask" /> {q}</label>)}
              <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mt-4 mb-1.5">Official pages</div>
              <div className="flex flex-col gap-1.5">{g.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-[13px]" style={{ color: 'var(--accent-ink)', textDecoration: 'underline' }} data-testid="slot-guide-link">{l.label}</a>)}</div>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel title="Other Schengen countries" subtitle="No card yet — I have not checked these" testid="slot-guide-card"
          action={<span className="chip" style={chip('Not checked yet')} data-testid="slot-guide-status">Not checked yet</span>}>
          <div className="text-[13.5px] mb-2">Before the first client is promised a date for one of these, do the three steps below and keep the answers.</div>
          <ol className="pl-5 m-0 text-[13.5px]" style={{ listStyle: 'decimal' }}>{UNCHECKED_HOW_TO.map((t, i) => <li key={i} className="mb-1.5">{t}</li>)}</ol>
          <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--muted)] mt-4 mb-1.5">Still to check</div>
          <div className="flex gap-1.5 flex-wrap" data-testid="slot-guide-todo">{others.map(c => <span key={c} className="chip">{c}</span>)}</div>
        </Panel>
      )}
    </div>
  );
}
