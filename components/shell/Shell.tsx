'use client';
import Image from 'next/image';
import { useAppData } from '@/lib/AppDataContext';
import { useToast } from '@/components/ui/Toast';
import { LOGO_ICON } from '@/lib/logo';

export const CEO_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'leads', label: 'Leads' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'cases', label: 'Cases' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'pricing', label: 'Pricing by country' },
  { id: 'hr', label: 'HR Department' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'reports', label: 'Reports & Finance' },
  { id: 'testimonials', label: 'Success Stories' },
  { id: 'referralagents', label: 'Referral Agents' },
  { id: 'grouptours', label: 'Group Tours' },
];

const TITLES: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'Business status across every country, at a glance'],
  leads: ['Leads', 'Every enquiry, from first WhatsApp message to conversion'],
  campaigns: ['Campaigns', 'Ad and outreach performance, cost per lead and per conversion'],
  cases: ['Cases', 'Active and closed visa applications'],
  appointments: ['Appointments', 'Embassy dates, consultations and document collections — any time, any day'],
  pricing: ['Pricing by country', 'Consultation, visa service and appointment fees'],
  hr: ['HR Department', 'Employee records, roles, contracts, requests and performance'],
  attendance: ['Attendance', 'Check-in, check-out and duty timings, tracked daily'],
  accounts: ['Accounts', 'Income, expenses, receivables, payroll and commissions'],
  reports: ['Reports & Finance', 'Weekly comparison, monthly trend, bank balances, expenses and journal vouchers'],
  testimonials: ['Success Stories', 'Client testimonials, star ratings, and your approval rate — your strongest trust signal'],
  referralagents: ['Referral Agents', 'External partners who bring clients directly, paid on net profit — separate from your own staff'],
  grouptours: ['Group Tours', 'Package tour registrations, traveler rosters, and public QR verification'],
  myportal: ['My Portal', 'Your own attendance, cases and earnings'],
};

export function Shell({
  currentTab, onTabChange, topAction, children,
}: {
  currentTab: string;
  onTabChange: (t: string) => void;
  topAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { session, setSession, team, leads, requests, clientFeedback } = useAppData();
  const toast = useToast();
  const isCeo = session?.type === 'ceo' || (session?.type === 'employee' && !!team.find(t => t.id === session.staffId)?.isAdmin);
  const me = session?.type === 'employee' ? team.find(t => t.id === session.staffId) : null;
  const title = TITLES[currentTab] || ['', ''];

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const overdueLeads = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= todayStr && !['Converted', 'Lost'].includes(l.stage)).length;
  const pendingRequests = requests.filter(r => r.status === 'Pending').length;
  const urgentFeedback = clientFeedback.filter(f => f.moneyDemanded && !f.reviewedByCeo).length;
  const BADGES: Record<string, number> = {
    leads: overdueLeads,
    hr: pendingRequests + urgentFeedback,
  };

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    setSession(null);
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-[220px] flex-none flex flex-col p-5 sticky top-0 h-screen overflow-y-auto text-[#DCF3E9]"
        style={{ background: 'linear-gradient(165deg,#14213D 0%,#1B3358 100%)', boxShadow: '0 16px 40px rgba(20,33,61,.16)' }}
      >
        <div className="flex items-center gap-2.5 pb-5 px-2">
          <img
            src={LOGO_ICON}
            alt="GoGlobe Consultants"
            className="w-8 h-8 rounded-[9px] object-cover bg-white flex-none"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}
          />
          <div>
            <div className="font-display font-semibold text-[15px] text-white leading-tight">GoGlobe Ops</div>
            <div className="text-[10.5px] text-[#9FCBB6] uppercase tracking-wide">Client &amp; Case Portal</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 mt-1.5">
          {isCeo
            ? CEO_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-left text-[13.5px] font-medium transition-all"
                  style={{
                    color: currentTab === t.id ? '#fff' : '#BFE6D3',
                    background: currentTab === t.id ? 'rgba(255,255,255,.14)' : 'transparent',
                    boxShadow: currentTab === t.id ? 'inset 0 0 0 1px rgba(255,255,255,.12)' : 'none',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] flex-none" />
                  <span className="flex-1">{t.label}</span>
                  {BADGES[t.id] > 0 && (
                    <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-none" style={{ background: 'var(--red)', color: '#fff' }}>
                      {BADGES[t.id]}
                    </span>
                  )}
                </button>
              ))
            : (
                <button className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-left text-[13.5px] font-medium bg-white/15 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] flex-none" />
                  My Portal
                </button>
              )}
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-left text-[13.5px] font-medium mt-2.5"
            style={{ color: '#F5C7C0' }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: '#F5C7C0' }} />
            Log out
          </button>
        </nav>

        <div className="mt-auto pt-3.5 border-t border-white/10 text-[11.5px] text-[#8FBFA9]">
          {session?.type === 'ceo'
            ? <>Signed in as <b className="text-white">CEO / Owner</b><br />Full access to every module.</>
            : isCeo
            ? <>Signed in as <b className="text-white">{me?.name}</b><br />Full admin access, granted by the owner.</>
            : <>Signed in as <b className="text-white">{me?.name}</b><br />You can only see your own work.</>}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div
          className="flex items-center justify-between px-7 py-4 sticky top-0 z-[5]"
          style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(10px)' }}
        >
          <div>
            <h1 className="font-display font-semibold text-[19px] m-0">{title[0]}</h1>
            <div className="text-xs text-[var(--muted)] mt-0.5">{title[1]}</div>
          </div>
          {isCeo && <div className="flex gap-2">{topAction}</div>}
        </div>
        <div className="px-7 py-6 pb-16 max-w-[1280px]">{children}</div>
      </div>
    </div>
  );
}
