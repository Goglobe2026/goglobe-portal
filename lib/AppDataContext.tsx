'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type {
  Lead, Case, Appointment, TeamMember, Transaction, Campaign, AttendanceRecord,
  RateCardEntry, Adjustment, BankAccount, JournalVoucher, EmployeeRequest,
  ActivityItem, Testimonial, ReferralAgent, GroupTour, TourMember, CountryNote, Loan, PersonalExpense, ClientFeedback, MarketingMaterial, FollowUpTemplate, Invoice, MonthlyClosing, PayrollCategory, PayRun, StaffAdvance, Complaint, StaffTarget, Appraisal, Announcement, DocRecord, Letter, QcCheck, TeamMessage, LeadSource, Session, CollectionName,
} from './types';

type Updater<T> = T | ((prev: T) => T);

// ---------------------------------------------------------------------------
// Saving and staying up to date
//
// Every list (leads, cases, ...) lives on the server. This hook keeps a copy in
// the browser and, when someone edits, sends the change back safely:
//   - each record that changed is stamped `_u` (time of the edit, in server
//     time) and the ids that were removed are listed, so the server can merge
//     with whatever other people changed instead of overwriting it;
//   - saves for one list are sent one after another, never out of order;
//   - every 15 seconds the browser asks which lists changed elsewhere and pulls
//     them in, so a lead that arrived from the sheet shows up on its own.
// ---------------------------------------------------------------------------
const writeSeq: Record<string, number> = {};      // bumps on every local edit
const inflight: Record<string, number> = {};      // saves currently on their way
const lastWriteEnd: Record<string, number> = {};  // when the last save finished
const chains: Record<string, Promise<unknown>> = {};
let clockOffset = 0;                              // server time minus this device's time

type Rec = { id: string; _u?: number };
const hasIds = (a: unknown): a is Rec[] => Array.isArray(a) && a.every(x => x && typeof x === 'object' && typeof (x as Rec).id === 'string');

function stampChanged<T>(prev: T, next: T): T {
  if (!hasIds(prev) || !hasIds(next)) return next;
  const before = new Map(prev.map(r => [r.id, r]));
  const at = Date.now() + clockOffset;
  let touched = false;
  const out = next.map(item => {
    const old = before.get(item.id);
    if (old === item) return item;
    if (old) {
      const { _u: a, ...restOld } = old as Rec & Record<string, unknown>; void a;
      const { _u: b, ...restNew } = item as Rec & Record<string, unknown>; void b;
      if (JSON.stringify(restOld) === JSON.stringify(restNew)) return item;
    }
    touched = true;
    return { ...item, _u: at };
  });
  return (touched ? out : next) as unknown as T;
}

function queueSave(key: string, prev: unknown, next: unknown) {
  writeSeq[key] = (writeSeq[key] || 0) + 1;
  let body: unknown = next;
  if (hasIds(prev) && hasIds(next)) {
    const nextIds = new Set(next.map(r => r.id));
    body = { __merge: 1, items: next, deleted: prev.map(r => r.id).filter(id => !nextIds.has(id)) };
  }
  inflight[key] = (inflight[key] || 0) + 1;
  const send = () => fetch(`/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => { /* surfaced globally via lastError */ });
  chains[key] = (chains[key] || Promise.resolve()).then(send).finally(() => {
    inflight[key]--;
    lastWriteEnd[key] = Date.now();
  });
}

function useSynced<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  const setAndSave = useCallback((updater: Updater<T>) => {
    setValue(prev => {
      const raw = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      if (raw === prev) return prev;
      const next = stampChanged(prev, raw);
      queueSave(key, prev, next);
      return next;
    });
  }, [key]);

  return { value, setAndSave, setLocal: setValue, ready, setReady };
}

interface AppDataContextValue {
  loading: boolean;
  connectionError: string | null;
  session: Session | null;
  setSession: (s: Session | null) => void;

  leads: Lead[]; setLeads: (u: Updater<Lead[]>) => void;
  cases: Case[]; setCases: (u: Updater<Case[]>) => void;
  appointments: Appointment[]; setAppointments: (u: Updater<Appointment[]>) => void;
  team: TeamMember[]; setTeam: (u: Updater<TeamMember[]>) => void;
  transactions: Transaction[]; setTransactions: (u: Updater<Transaction[]>) => void;
  campaigns: Campaign[]; setCampaigns: (u: Updater<Campaign[]>) => void;
  attendance: AttendanceRecord[]; setAttendance: (u: Updater<AttendanceRecord[]>) => void;
  rateCard: RateCardEntry[]; setRateCard: (u: Updater<RateCardEntry[]>) => void;
  adjustments: Adjustment[]; setAdjustments: (u: Updater<Adjustment[]>) => void;
  bankAccounts: BankAccount[]; setBankAccounts: (u: Updater<BankAccount[]>) => void;
  journalVouchers: JournalVoucher[]; setJournalVouchers: (u: Updater<JournalVoucher[]>) => void;
  requests: EmployeeRequest[]; setRequests: (u: Updater<EmployeeRequest[]>) => void;
  activity: ActivityItem[]; setActivity: (u: Updater<ActivityItem[]>) => void;
  testimonials: Testimonial[]; setTestimonials: (u: Updater<Testimonial[]>) => void;
  referralAgents: ReferralAgent[]; setReferralAgents: (u: Updater<ReferralAgent[]>) => void;
  groupTours: GroupTour[]; setGroupTours: (u: Updater<GroupTour[]>) => void;
  tourMembers: TourMember[]; setTourMembers: (u: Updater<TourMember[]>) => void;
  countryNotes: CountryNote[]; setCountryNotes: (u: Updater<CountryNote[]>) => void;
  loans: Loan[]; setLoans: (u: Updater<Loan[]>) => void;
  personalExpenses: PersonalExpense[]; setPersonalExpenses: (u: Updater<PersonalExpense[]>) => void;
  clientFeedback: ClientFeedback[]; setClientFeedback: (u: Updater<ClientFeedback[]>) => void;
  marketingMaterials: MarketingMaterial[]; setMarketingMaterials: (u: Updater<MarketingMaterial[]>) => void;
  followUpTemplates: FollowUpTemplate[]; setFollowUpTemplates: (u: Updater<FollowUpTemplate[]>) => void;
  invoices: Invoice[]; setInvoices: (u: Updater<Invoice[]>) => void;
  monthlyClosings: MonthlyClosing[]; setMonthlyClosings: (u: Updater<MonthlyClosing[]>) => void;
  payrollCategories: PayrollCategory[]; setPayrollCategories: (u: Updater<PayrollCategory[]>) => void;
  payRuns: PayRun[]; setPayRuns: (u: Updater<PayRun[]>) => void;
  staffAdvances: StaffAdvance[]; setStaffAdvances: (u: Updater<StaffAdvance[]>) => void;
  complaints: Complaint[]; setComplaints: (u: Updater<Complaint[]>) => void;
  staffTargets: StaffTarget[]; setStaffTargets: (u: Updater<StaffTarget[]>) => void;
  appraisals: Appraisal[]; setAppraisals: (u: Updater<Appraisal[]>) => void;
  announcements: Announcement[]; setAnnouncements: (u: Updater<Announcement[]>) => void;
  docRegister: DocRecord[]; setDocRegister: (u: Updater<DocRecord[]>) => void;
  letters: Letter[]; setLetters: (u: Updater<Letter[]>) => void;
  qcChecks: QcCheck[]; setQcChecks: (u: Updater<QcCheck[]>) => void;
  messages: TeamMessage[]; setMessages: (u: Updater<TeamMessage[]>) => void;
  leadSources: LeadSource[]; setLeadSources: (u: Updater<LeadSource[]>) => void;
  ceoPin: string; setCeoPin: (u: Updater<string>) => void;
  playbook: string; setPlaybook: (u: Updater<string>) => void;
  sheetSyncUrl: string; setSheetSyncUrl: (u: Updater<string>) => void;
  revenueGoal: string; setRevenueGoal: (u: Updater<string>) => void;

  logActivity: (t: string) => void;
  // Pull the newest copy of some lists from the server right now.
  refresh: (lists?: CollectionName[]) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

const COLLECTION_KEYS: CollectionName[] = [
  'leads', 'cases', 'appointments', 'team', 'transactions', 'campaigns',
  'attendance', 'ratecard', 'adjustments', 'bankaccounts', 'journalvouchers',
  'requests', 'activity', 'testimonials', 'referralagents', 'grouptours', 'tourmembers', 'countrynotes', 'loans', 'personalexpenses', 'clientfeedback', 'marketingmaterials', 'followuptemplates', 'invoices', 'monthlyclosings', 'payrollcategories', 'payruns', 'staffadvances',
  'complaints', 'stafftargets', 'appraisals', 'announcements', 'docregister', 'letters', 'qcchecks', 'messages', 'leadsources',
];

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const leads = useSynced<Lead[]>('leads', []);
  const cases = useSynced<Case[]>('cases', []);
  const appointments = useSynced<Appointment[]>('appointments', []);
  const team = useSynced<TeamMember[]>('team', []);
  const transactions = useSynced<Transaction[]>('transactions', []);
  const campaigns = useSynced<Campaign[]>('campaigns', []);
  const attendance = useSynced<AttendanceRecord[]>('attendance', []);
  const rateCard = useSynced<RateCardEntry[]>('ratecard', []);
  const adjustments = useSynced<Adjustment[]>('adjustments', []);
  const bankAccounts = useSynced<BankAccount[]>('bankaccounts', []);
  const journalVouchers = useSynced<JournalVoucher[]>('journalvouchers', []);
  const requests = useSynced<EmployeeRequest[]>('requests', []);
  const activity = useSynced<ActivityItem[]>('activity', []);
  const testimonials = useSynced<Testimonial[]>('testimonials', []);
  const referralAgents = useSynced<ReferralAgent[]>('referralagents', []);
  const groupTours = useSynced<GroupTour[]>('grouptours', []);
  const tourMembers = useSynced<TourMember[]>('tourmembers', []);
  const countryNotes = useSynced<CountryNote[]>('countrynotes', []);
  const loans = useSynced<Loan[]>('loans', []);
  const personalExpenses = useSynced<PersonalExpense[]>('personalexpenses', []);
  const clientFeedback = useSynced<ClientFeedback[]>('clientfeedback', []);
  const marketingMaterials = useSynced<MarketingMaterial[]>('marketingmaterials', []);
  const followUpTemplates = useSynced<FollowUpTemplate[]>('followuptemplates', []);
  const invoices = useSynced<Invoice[]>('invoices', []);
  const monthlyClosings = useSynced<MonthlyClosing[]>('monthlyclosings', []);
  const payrollCategories = useSynced<PayrollCategory[]>('payrollcategories', []);
  const payRuns = useSynced<PayRun[]>('payruns', []);
  const staffAdvances = useSynced<StaffAdvance[]>('staffadvances', []);
  const complaints = useSynced<Complaint[]>('complaints', []);
  const staffTargets = useSynced<StaffTarget[]>('stafftargets', []);
  const appraisals = useSynced<Appraisal[]>('appraisals', []);
  const announcements = useSynced<Announcement[]>('announcements', []);
  const docRegister = useSynced<DocRecord[]>('docregister', []);
  const letters = useSynced<Letter[]>('letters', []);
  const qcChecks = useSynced<QcCheck[]>('qcchecks', []);
  const messages = useSynced<TeamMessage[]>('messages', []);
  const leadSources = useSynced<LeadSource[]>('leadsources', []);
  const ceoPin = useSynced<string>('ceopin', '9999');
  const playbook = useSynced<string>('playbook', '');
  const sheetSyncUrl = useSynced<string>('sheetsyncurl', '');
  const revenueGoal = useSynced<string>('revenuegoal', '10000000');

  // Every list the browser keeps a copy of, by the name the server uses.
  const lists: Record<string, { setLocal: (u: any) => void }> = {
    leads, cases, appointments, team, transactions, campaigns, attendance, ratecard: rateCard, adjustments,
    bankaccounts: bankAccounts, journalvouchers: journalVouchers, requests, activity, testimonials,
    referralagents: referralAgents, grouptours: groupTours, tourmembers: tourMembers, countrynotes: countryNotes,
    loans, personalexpenses: personalExpenses, clientfeedback: clientFeedback, marketingmaterials: marketingMaterials,
    followuptemplates: followUpTemplates, invoices, monthlyclosings: monthlyClosings, payrollcategories: payrollCategories,
    payruns: payRuns, staffadvances: staffAdvances, complaints, stafftargets: staffTargets, appraisals, announcements,
    docregister: docRegister, letters, qcchecks: qcChecks, messages, leadsources: leadSources,
  };
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const lastVersion = useRef<Record<string, number>>({});
  const pulling = useRef(false);

  // Ask the server what changed and pull in those lists. Skips any list this
  // person is in the middle of saving, and tries again on the next round.
  const pullLists = useCallback(async (only?: string[], force = false) => {
    if (pulling.current && !force) return;
    pulling.current = true;
    try {
      const t0 = Date.now();
      const vr = await fetch('/api/data/versions', { cache: 'no-store' });
      if (!vr.ok) return;
      const { now, versions } = await vr.json();
      const rtt = Date.now() - t0;
      if (rtt < 4000 && typeof now === 'number') clockOffset = now - (t0 + rtt / 2);
      for (const k of Object.keys(listsRef.current)) {
        if (only && !only.includes(k)) continue;
        const v = versions[k];
        if (v === undefined) continue;
        if (!force && lastVersion.current[k] === v) continue;
        const startedAt = Date.now();
        const seq = writeSeq[k] || 0;
        const r = await fetch(`/api/data/${k}`, { cache: 'no-store' });
        if (!r.ok) continue;
        const data = await r.json();
        if ((writeSeq[k] || 0) !== seq || (inflight[k] || 0) > 0 || (lastWriteEnd[k] || 0) >= startedAt) continue;
        lastVersion.current[k] = v;
        listsRef.current[k].setLocal((prev: unknown) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      }
    } catch { /* offline for a moment — the next round will catch up */ } finally {
      pulling.current = false;
    }
  }, []);

  const refresh = useCallback((names?: CollectionName[]) => pullLists(names as string[] | undefined, true), [pullLists]);

  useEffect(() => {
    if (!session) return;
    const tick = () => { if (document.visibilityState === 'visible') pullLists(); };
    const id = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [session, pullLists]);

  const logActivity = useCallback((t: string) => {
    activity.setAndSave(prev => [{ t, at: new Date().toISOString() }, ...prev].slice(0, 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const sRes = await fetch('/api/session');
        const sJson = await sRes.json();
        setSession(sJson.session);
        if (!sJson.session) { setLoading(false); return; }

        // Note what the server has right now, before downloading anything, so
        // a change that lands while we load is picked up by the next refresh.
        try {
          const t0 = Date.now();
          const vr = await fetch('/api/data/versions', { cache: 'no-store' });
          if (vr.ok) {
            const vj = await vr.json();
            lastVersion.current = vj.versions || {};
            const rtt = Date.now() - t0;
            if (rtt < 4000 && typeof vj.now === 'number') clockOffset = vj.now - (t0 + rtt / 2);
          }
        } catch { /* not fatal */ }

        const results = await Promise.all(
          [...COLLECTION_KEYS, 'ceopin', 'revenuegoal', 'playbook', 'sheetsyncurl'].map(k =>
            fetch(`/api/data/${k}`).then(async r => {
              // A 403 means this account correctly isn't allowed to see this
              // particular collection (e.g. a regular employee and bank
              // accounts) — that's expected and fine, not a broken app.
              // Only a genuine failure (500, network drop, etc.) should stop
              // the whole thing from loading.
              if (r.status === 403) return null;
              // A 404 here means the website pages are newer than the server files
              // (a partly uploaded update). Say so in plain words.
              if (r.status === 404) throw new Error(`The live site is running a mix of old and new files — the server does not know “${k}” yet. Upload ALL the files from the latest zip to GitHub together (do not pick files one by one), wait for Render to redeploy, then refresh this page. Your data is safe.`);
              if (!r.ok) throw new Error(`${k}: ${r.status}`);
              return r.json();
            })
          )
        );
        const [l, c, a, tm, tx, cp, att, rc, adj, bk, jv, req, act, tst, ra, gt, tmem, cn, ln, pe, cf, mm, fut, inv, mcl, pcat, prun, sadv, cpl, stg, apr, ann, dreg, ltr, qcc, msg, lsr, pin, goal, pb, ssu] = results;
        leads.setLocal(l || []); cases.setLocal(c || []); appointments.setLocal(a || []); team.setLocal(tm || []);
        transactions.setLocal(tx || []); campaigns.setLocal(cp || []); attendance.setLocal(att || []); rateCard.setLocal(rc || []);
        adjustments.setLocal(adj || []); bankAccounts.setLocal(bk || []); journalVouchers.setLocal(jv || []);
        requests.setLocal(req || []); activity.setLocal(act || []); testimonials.setLocal(tst || []); referralAgents.setLocal(ra || []);
        groupTours.setLocal(gt || []); tourMembers.setLocal(tmem || []); countryNotes.setLocal(cn || []);
        loans.setLocal(ln || []); personalExpenses.setLocal(pe || []); clientFeedback.setLocal(cf || []); marketingMaterials.setLocal(mm || []);
        followUpTemplates.setLocal(fut || []); invoices.setLocal(inv || []);
        monthlyClosings.setLocal(mcl || []); payrollCategories.setLocal(pcat || []);
        payRuns.setLocal(prun || []); staffAdvances.setLocal(sadv || []);
        complaints.setLocal(cpl || []); staffTargets.setLocal(stg || []); appraisals.setLocal(apr || []);
        announcements.setLocal(ann || []); docRegister.setLocal(dreg || []); letters.setLocal(ltr || []);
        qcChecks.setLocal(qcc || []); messages.setLocal(msg || []); leadSources.setLocal(lsr || []);
        ceoPin.setLocal(typeof pin === 'string' ? pin : '9999');
        playbook.setLocal(typeof pb === 'string' ? pb : '');
        sheetSyncUrl.setLocal(typeof ssu === 'string' ? ssu : '');
        revenueGoal.setLocal(typeof goal === 'string' ? goal : '10000000');
      } catch (e) {
        setConnectionError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AppDataContextValue = {
    loading, connectionError, session, setSession,
    leads: leads.value, setLeads: leads.setAndSave,
    cases: cases.value, setCases: cases.setAndSave,
    appointments: appointments.value, setAppointments: appointments.setAndSave,
    team: team.value, setTeam: team.setAndSave,
    transactions: transactions.value, setTransactions: transactions.setAndSave,
    campaigns: campaigns.value, setCampaigns: campaigns.setAndSave,
    attendance: attendance.value, setAttendance: attendance.setAndSave,
    rateCard: rateCard.value, setRateCard: rateCard.setAndSave,
    adjustments: adjustments.value, setAdjustments: adjustments.setAndSave,
    bankAccounts: bankAccounts.value, setBankAccounts: bankAccounts.setAndSave,
    journalVouchers: journalVouchers.value, setJournalVouchers: journalVouchers.setAndSave,
    requests: requests.value, setRequests: requests.setAndSave,
    activity: activity.value, setActivity: activity.setAndSave,
    testimonials: testimonials.value, setTestimonials: testimonials.setAndSave,
    referralAgents: referralAgents.value, setReferralAgents: referralAgents.setAndSave,
    groupTours: groupTours.value, setGroupTours: groupTours.setAndSave,
    tourMembers: tourMembers.value, setTourMembers: tourMembers.setAndSave,
    countryNotes: countryNotes.value, setCountryNotes: countryNotes.setAndSave,
    loans: loans.value, setLoans: loans.setAndSave,
    personalExpenses: personalExpenses.value, setPersonalExpenses: personalExpenses.setAndSave,
    clientFeedback: clientFeedback.value, setClientFeedback: clientFeedback.setAndSave,
    marketingMaterials: marketingMaterials.value, setMarketingMaterials: marketingMaterials.setAndSave,
    followUpTemplates: followUpTemplates.value, setFollowUpTemplates: followUpTemplates.setAndSave,
    invoices: invoices.value, setInvoices: invoices.setAndSave,
    monthlyClosings: monthlyClosings.value, setMonthlyClosings: monthlyClosings.setAndSave,
    payrollCategories: payrollCategories.value, setPayrollCategories: payrollCategories.setAndSave,
    payRuns: payRuns.value, setPayRuns: payRuns.setAndSave,
    staffAdvances: staffAdvances.value, setStaffAdvances: staffAdvances.setAndSave,
    complaints: complaints.value, setComplaints: complaints.setAndSave,
    staffTargets: staffTargets.value, setStaffTargets: staffTargets.setAndSave,
    appraisals: appraisals.value, setAppraisals: appraisals.setAndSave,
    announcements: announcements.value, setAnnouncements: announcements.setAndSave,
    docRegister: docRegister.value, setDocRegister: docRegister.setAndSave,
    letters: letters.value, setLetters: letters.setAndSave,
    qcChecks: qcChecks.value, setQcChecks: qcChecks.setAndSave,
    messages: messages.value, setMessages: messages.setAndSave,
    leadSources: leadSources.value, setLeadSources: leadSources.setAndSave,
    ceoPin: ceoPin.value, setCeoPin: ceoPin.setAndSave,
    playbook: playbook.value, setPlaybook: playbook.setAndSave,
    sheetSyncUrl: sheetSyncUrl.value, setSheetSyncUrl: sheetSyncUrl.setAndSave,
    revenueGoal: revenueGoal.value, setRevenueGoal: revenueGoal.setAndSave,
    logActivity, refresh,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
