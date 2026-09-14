'use client';
import Image from 'next/image';
import { useAppData } from '@/lib/AppDataContext';
import { useToast } from '@/components/ui/Toast';
import { LOGO_ICON } from '@/lib/logo';
import { NAV_GROUPS, findGroupForTab } from '@/lib/navGroups';

const TITLES: Record<string, [string, string]> = {
  hub: ['GoGlobe Ops', 'Choose a module to get started'],
  dashboard: ['Dashboard', 'Business status across every country, at a glance'],
  'grp-marketing': ['Marketing', 'Leads, campaigns, and everything that brings clients in'],
  leads: ['Leads', 'Every enquiry, from first WhatsApp message to conversion'],
  campaigns: ['Campaigns', 'Ad and outreach performance, cost per lead and per conversion'],
  testimonials: ['Success Stories', 'Client testimonials, star ratings, and your approval rate — your strongest trust signal'],
  'grp-cases': ['Cases & Clients', 'Active visa cases, appointments, and referral partners'],
  cases: ['Cases', 'Active and closed visa applications'],
  appointments: ['Appointments', 'Embassy dates, consultations and document collections — any time, any day'],
  referralagents: ['Referral Agents', 'External partners who bring clients directly, paid on net profit — separate from your own staff'],
  grouptours: ['Group Tours', 'Package tour registrations, traveler rosters, and public QR verification'],
  'grp-hr': ['HR', 'Your team — records, attendance, and requests'],
  hr: ['HR Department', 'Employee records, roles, contracts, requests and performance'],
  attendance: ['Attendance', 'Check-in, check-out and duty timings, tracked daily'],
  'grp-finance': ['Finance', 'Money in, money out, and what things cost'],
  accounts: ['Accounts', 'Income, expenses, receivables, payroll and commissions'],
  reports: ['Reports & Finance', 'Weekly comparison, monthly trend, bank balances, expenses and journal vouchers'],
  pricing: ['Pricing by country', 'Consultation, visa service and appointment fees'],
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
  // Badges now live on the group tile, since the individual leaf modules
  // (Leads, HR Department) aren't directly in the sidebar list anymore.
  const GROUP_BADGES: Record<string, number> = {
    'grp-marketing': overdueLeads,
    'grp-hr': pendingRequests + urgentFeedback,
  };

  const activeGroup = findGroupForTab(currentTab);

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
        <button onClick={() => onTabChange('hub')} className="flex items-center gap-2.5 pb-5 px-2 text-left" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
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
        </button>

        <nav className="flex flex-col gap-0.5 mt-1.5">
          {isCeo
            ? NAV_GROUPS.map(g => {
                const active = activeGroup ? activeGroup.id === g.id : currentTab === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => onTabChange(g.id)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-left text-[13.5px] font-medium transition-all"
                    style={{
                      color: active ? '#fff' : '#BFE6D3',
                      background: active ? 'rgba(255,255,255,.14)' : 'transparent',
                      boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,.12)' : 'none',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] flex-none" />
                    <span className="flex-1">{g.label}</span>
                    {GROUP_BADGES[g.id] > 0 && (
                      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-none" style={{ background: 'var(--red)', color: '#fff' }}>
                        {GROUP_BADGES[g.id]}
                      </span>
                    )}
                  </button>
                );
              })
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
