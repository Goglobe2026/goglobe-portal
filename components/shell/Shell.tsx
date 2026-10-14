'use client';
import Image from 'next/image';
import { useAppData } from '@/lib/AppDataContext';
import { useToast } from '@/components/ui/Toast';
import { LOGO_ICON } from '@/lib/logo';
import { useEffect, useState } from 'react';
import { sidebarSections } from '@/lib/navGroups';
import { myMessageId, unreadFor } from '@/lib/messages';
import { TILE_ICONS, DEFAULT_ICON } from './GroupDashboard';

const TITLES: Record<string, [string, string]> = {
  hub: ['GoGlobe Ops', 'Choose a module to get started'],
  dashboard: ['Dashboard', 'Business status across every country, at a glance'],
  'grp-marketing': ['Marketing', 'Leads, campaigns, and everything that brings clients in'],
  leads: ['Leads', 'Every enquiry, from first WhatsApp message to conversion'],
  leadsources: ['Lead Sources', 'One sheet link per ad form — leads, their answers and the results of each form, country by country'],
  perfwatch: ['Performance Watch', 'Flags leads nobody has touched, missed follow-ups, late or absent days and targets running behind — for every employee, automatically'],
  adsmanager: ['Ads Manager', 'Your Meta campaigns — status, spend and leads — set against the clients they brought and what those clients have paid'],
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
  billing: ['Billing Center', 'Every client balance still owed, who is overdue, and one-tap payment reminders'],
  complaints: ['Complaints & Feedback', 'Log, assign and resolve client complaints, and see what clients rate you'],
  clientdocs: ['Client Documents', 'Original documents received from clients — where each one is right now'],
  appraisal: ['Targets & Appraisal', 'Set monthly targets, see progress, and score each employee fairly'],
  announcements: ['Announcements', 'Notices that appear in every employee’s own portal'],
  letters: ['Letters & Certificates', 'Experience, salary, appointment and warning letters on company letterhead'],
  payroll: ['Payroll', 'Monthly pay runs, payslips, pay categories, staff advances and payroll reports'],
  profit: ['Profit & Growth', 'Net profit for the month, the money that is not profit kept apart, and how the business is growing'],
  closing: ['Monthly Closing', 'Month-end cash position, collections received, pending balances and the balance carried forward'],
  reports: ['Reports & Finance', 'Weekly comparison, monthly trend, bank balances, expenses and journal vouchers'],
  pricing: ['Pricing by country', 'Consultation, visa service and appointment fees'],
  'grp-quality': ['Quality & Team', 'Check files before they go out, and talk to your team privately'],
  dailyreport: ['Daily Report', 'The whole business in one WhatsApp message — sent to you automatically every day'],
  qc: ['Quality Control', 'Check every file before it is submitted — nothing goes out with a missing step'],
  messages: ['Team Messages', 'Private one-to-one messages — only the two people in a chat can read it'],
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
  const { session, setSession, team, leads, requests, clientFeedback, transactions, monthlyClosings, messages } = useAppData();
  const toast = useToast();
  const isCeo = session?.type === 'ceo' || (session?.type === 'employee' && !!team.find(t => t.id === session.staffId)?.isAdmin);
  const me = session?.type === 'employee' ? team.find(t => t.id === session.staffId) : null;
  const title = TITLES[currentTab] || ['', ''];

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const overdueLeads = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= todayStr && !['Converted', 'Lost'].includes(l.stage)).length;
  const pendingRequests = requests.filter(r => r.status === 'Pending').length;
  const urgentFeedback = clientFeedback.filter(f => f.moneyDemanded && !f.reviewedByCeo).length;
  // Small red counters on the sidebar links.
  // A gentle nudge: last month had activity but hasn't been closed yet.
  const prevMonthKey = (() => { const [y, m] = todayStr.slice(0, 7).split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const closingPending = isCeo && transactions.some(t => t.date.slice(0, 7) === prevMonthKey) && !monthlyClosings.some(c => c.month === prevMonthKey) ? 1 : 0;
  const ITEM_BADGES: Record<string, number> = {
    leads: overdueLeads,
    hr: pendingRequests + urgentFeedback,
    closing: closingPending,
    messages: unreadFor(messages, myMessageId(session)),
  };

  const sections = sidebarSections();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem('goglobe-sidebar-collapsed') === '1'); } catch { /* ignore */ } }, []);
  function toggleSidebar() {
    setCollapsed(c => { const n = !c; try { localStorage.setItem('goglobe-sidebar-collapsed', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    setSession(null);
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="flex-none flex flex-col sticky top-0 h-screen overflow-y-auto overflow-x-hidden text-[#DCF3E9]"
        style={{
          width: collapsed ? 64 : 232, padding: collapsed ? '20px 8px' : '20px 14px', transition: 'width .16s ease, padding .16s ease',
          background: 'linear-gradient(165deg,#14213D 0%,#1B3358 100%)', boxShadow: '0 16px 40px rgba(20,33,61,.16)',
        }}
      >
        <div className={`flex items-center pb-4 ${collapsed ? 'flex-col gap-3' : 'gap-2.5 px-1.5 justify-between'}`}>
          <button onClick={() => onTabChange('hub')} title="All modules" className="flex items-center gap-2.5 text-left min-w-0" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <img
              src={LOGO_ICON}
              alt="GoGlobe Consultants"
              className="w-8 h-8 rounded-[9px] object-cover bg-white flex-none"
              style={{ boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display font-semibold text-[15px] text-white leading-tight">GoGlobe Ops</div>
                <div className="text-[10.5px] text-[#9FCBB6] uppercase tracking-wide">Client &amp; Case Portal</div>
              </div>
            )}
          </button>
          {isCeo && (
            <button
              onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Minimize sidebar'} title={collapsed ? 'Expand sidebar' : 'Minimize sidebar'}
              className="flex-none w-6 h-6 rounded-full flex items-center justify-center text-[11px]"
              style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.18)', cursor: 'pointer', padding: 0 }}
            >{collapsed ? '➤' : '◀'}</button>
          )}
        </div>

        <nav className="flex flex-col gap-0.5">
          {isCeo ? (
            <>
              <SideLink id="dashboard" label="Dashboard" active={currentTab === 'dashboard'} collapsed={collapsed} onClick={() => onTabChange('dashboard')} />
              {session?.type === 'ceo' && <SideLink id="dailyreport" label="Daily Report" active={currentTab === 'dailyreport'} collapsed={collapsed} onClick={() => onTabChange('dailyreport')} />}
              {sections.map(sec => (
                <div key={sec.id}>
                  {collapsed
                    ? <div className="mx-2 my-2.5" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }} />
                    : (
                      <button
                        onClick={() => onTabChange(sec.groupId)} title={`Open the ${sec.label} overview`}
                        className="w-full text-left px-2.5 pt-4 pb-1 text-[10.5px] font-bold uppercase tracking-[.08em] hover:text-white"
                        style={{ color: currentTab === sec.groupId ? '#fff' : 'rgba(255,255,255,.45)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >{sec.label}</button>
                    )}
                  {sec.items.map(it => (
                    <SideLink key={it.id} id={it.id} label={it.label} badge={ITEM_BADGES[it.id]} active={currentTab === it.id} collapsed={collapsed} onClick={() => onTabChange(it.id)} />
                  ))}
                </div>
              ))}
            </>
          ) : (
            <SideLink id="myportal" label="My Portal" active collapsed={collapsed} badge={unreadFor(messages, myMessageId(session))} onClick={() => {}} />
          )}
          <button
            onClick={logout}
            title="Log out"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-left text-[13.5px] font-medium mt-3"
            style={{ color: '#F5C7C0', justifyContent: collapsed ? 'center' : undefined }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: '#F5C7C0' }} />
            {!collapsed && 'Log out'}
          </button>
        </nav>

        {!collapsed && (
          <div className="mt-auto pt-3.5 border-t border-white/10 text-[11.5px] text-[#8FBFA9]">
            {session?.type === 'ceo'
              ? <>Signed in as <b className="text-white">Head Manager</b><br />Full access to every module.</>
              : isCeo
              ? <>Signed in as <b className="text-white">{me?.name}</b><br />Full admin access, granted by the Head Manager.</>
              : <>Signed in as <b className="text-white">{me?.name}</b><br />You can only see your own work.</>}
          </div>
        )}
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


function SideLink({ id, label, active, collapsed, badge, onClick }: { id: string; label: string; active: boolean; collapsed: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick} title={collapsed ? label : undefined}
      className="relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-[9px] text-left text-[13.5px] font-medium transition-all w-full"
      style={{
        color: active ? '#fff' : '#BFE6D3',
        background: active ? 'rgba(255,255,255,.14)' : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,.12)' : 'none',
        justifyContent: collapsed ? 'center' : undefined,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#F2C66D' : '#C9922E'} strokeWidth="1.8" className="flex-none">
        {TILE_ICONS[id] || DEFAULT_ICON}
      </svg>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!!badge && badge > 0 && (
        collapsed
          ? <span className="absolute top-0.5 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--red)' }} />
          : <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-none" style={{ background: 'var(--red)', color: '#fff' }}>{badge}</span>
      )}
    </button>
  );
}
