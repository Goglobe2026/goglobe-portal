'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type {
  Lead, Case, Appointment, TeamMember, Transaction, Campaign, AttendanceRecord,
  RateCardEntry, Adjustment, BankAccount, JournalVoucher, EmployeeRequest,
  ActivityItem, Testimonial, ReferralAgent, GroupTour, TourMember, CountryNote, Loan, PersonalExpense, Session, CollectionName,
} from './types';

type Updater<T> = T | ((prev: T) => T);

function useSynced<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  const setAndSave = useCallback((updater: Updater<T>) => {
    setValue(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      fetch(`/api/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      }).catch(() => { /* surfaced globally via lastError */ });
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
  ceoPin: string; setCeoPin: (u: Updater<string>) => void;
  revenueGoal: string; setRevenueGoal: (u: Updater<string>) => void;

  logActivity: (t: string) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

const COLLECTION_KEYS: CollectionName[] = [
  'leads', 'cases', 'appointments', 'team', 'transactions', 'campaigns',
  'attendance', 'ratecard', 'adjustments', 'bankaccounts', 'journalvouchers',
  'requests', 'activity', 'testimonials', 'referralagents', 'grouptours', 'tourmembers', 'countrynotes', 'loans', 'personalexpenses',
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
  const ceoPin = useSynced<string>('ceopin', '9999');
  const revenueGoal = useSynced<string>('revenuegoal', '10000000');

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

        const results = await Promise.all(
          [...COLLECTION_KEYS, 'ceopin', 'revenuegoal'].map(k =>
            fetch(`/api/data/${k}`).then(r => { if (!r.ok) throw new Error(`${k}: ${r.status}`); return r.json(); })
          )
        );
        const [l, c, a, tm, tx, cp, att, rc, adj, bk, jv, req, act, tst, ra, gt, tmem, cn, ln, pe, pin, goal] = results;
        leads.setLocal(l); cases.setLocal(c); appointments.setLocal(a); team.setLocal(tm);
        transactions.setLocal(tx); campaigns.setLocal(cp); attendance.setLocal(att); rateCard.setLocal(rc);
        adjustments.setLocal(adj); bankAccounts.setLocal(bk); journalVouchers.setLocal(jv);
        requests.setLocal(req); activity.setLocal(act); testimonials.setLocal(tst); referralAgents.setLocal(ra);
        groupTours.setLocal(gt); tourMembers.setLocal(tmem); countryNotes.setLocal(cn);
        loans.setLocal(ln); personalExpenses.setLocal(pe);
        ceoPin.setLocal(typeof pin === 'string' ? pin : '9999');
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
    ceoPin: ceoPin.value, setCeoPin: ceoPin.setAndSave,
    revenueGoal: revenueGoal.value, setRevenueGoal: revenueGoal.setAndSave,
    logActivity,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
