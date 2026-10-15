'use client';
import { useAppData } from '@/lib/AppDataContext';
import { LOGO_ICON } from '@/lib/logo';
import { useEffect, useState } from 'react';
import { sidebarSections, findGroupForTab } from '@/lib/navGroups';
import { myMessageId, unreadFor } from '@/lib/messages';
import { Icon } from '@/components/ui/icons';
import { ModuleHero, initials } from '@/components/ui/Kit';
import { themeOf, themeVars } from '@/lib/moduleTheme';
import { useHeroStats } from './useHeroStats';
import { AssistantDock, openAssistant } from './AssistantDock';

export const TITLES: Record<string, [string, string]> = {
  hub: ['GoGlobe Ops', 'Choose a module to get started'],
  dashboard: ['Dashboard', 'Business status across every country, at a glance'],
  'grp-marketing': ['Marketing', 'Leads, campaigns, and everything that brings clients in'],
  leads: ['Leads', 'Every enquiry, from first WhatsApp message to conversion'],
  leadsources: ['Lead Sources', 'One sheet link per ad form — leads, their answers and the results of each form, country by country'],
  perfwatch: ['Performance Watch', 'Flags leads nobody has touched, missed follow-ups, late or absent days and targets running behind — for every employee, automatically'],
  adsmanager: ['Ads Manager', 'Your Meta campaigns — status, spend and leads — set against the clients they brought and what those clients have paid'],
  campaigns: ['Campaigns', 'Ad and outreach performance, cost per lead and per conversion'],
  coach: ['Sales Coach', 'What to do next with each lead, how to follow up and convert, ready-made posts — and an assistant for when you are stuck'],
  testimonials: ['Success Stories', 'Client testimonials, star ratings, and your approval rate — your strongest trust signal'],
  'grp-cases': ['Cases & Clients', 'Active visa cases, appointments, and referral partners'],
  cases: ['Cases', 'Active and closed visa applications'],
  appointments: ['Appointments', 'Embassy dates, consultations and document collections — any time, any day'],
  referralagents: ['Referral Agents', 'External partners who bring clients directly, paid on net profit — separate from your own staff'],
  grouptours: ['Group Tours', 'Package tour registrations, traveler rosters, and public QR verification'],
  'grp-hr': ['HR', 'Your team — records, attendance, and requests'],
  hr: ['HR Department', 'Employee records, roles, contracts, requests and performance'],
  attendance: ['Attendance', 'Check-in, check-out and duty timings, tracked daily'],
  'grp-finance': ['Finance', 'Money in, money out, and what we keep'],
  money: ['Finance Overview', 'Where the money stands right now — what came in, what is still owed to us, what we spent and what we kept'],
  accounts: ['Books & Banks', 'Every money entry, plus bank accounts, loans, journal vouchers and targets'],
  billing: ['Who Owes Us', 'Every client balance still owed, who is late, and one-tap payment reminders'],
  complaints: ['Complaints & Feedback', 'Log, assign and resolve client complaints, and see what clients rate you'],
  clientdocs: ['Client Documents', 'Original documents received from clients — where each one is right now'],
  appraisal: ['Targets & Appraisal', 'Set monthly targets, see progress, and score each employee fairly'],
  announcements: ['Announcements', 'Notices that appear in every employee’s own portal'],
  letters: ['Letters & Certificates', 'Experience, salary, appointment and warning letters on company letterhead'],
  payroll: ['Payroll', 'Monthly pay runs, payslips, pay categories, staff advances and payroll reports'],
  profit: ['Profit & Growth', 'What we kept this month, the money that is not profit kept apart, and how the business is growing'],
  closing: ['Month-End', 'Lock the month: cash in and out, the balance carried forward and every client balance still to collect'],
  reports: ['Books & Banks', 'Every money entry, plus bank accounts, loans, journal vouchers and targets'],
  payouts: ['Money Going Out', 'What is leaving the account — embassy fees, salaries, bonuses and commissions — against what clients will pay'],
  pricing: ['Pricing by country', 'Consultation, visa service and appointment fees'],
  'grp-quality': ['Quality & Team', 'Check files before they go out, and talk to your team privately'],
  dailyreport: ['Daily Report', 'The whole business in one WhatsApp message — sent to you automatically every day'],
  qc: ['Quality Control', 'Check every file before it is submitted — nothing goes out with a missing step'],
  messages: ['Team Messages', 'Private one-to-one messages — only the two people in a chat can read it'],
  myportal: ['My Portal', 'Your own attendance, cases and earnings'],
};

const dotOf = (id: string) => `hsl(${themeOf(id).hue} 88% 68%)`;

export function Shell({
  currentTab, onTabChange, topAction, children,
}: {
  currentTab: string;
  onTabChange: (t: string) => void;
  topAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { session, setSession, team, leads, requests, clientFeedback, transactions, monthlyClosings, messages } = useAppData();
  const isCeo = session?.type === 'ceo' || (session?.type === 'employee' && !!team.find(t => t.id === session.staffId)?.isAdmin);
  const me = session?.type === 'employee' ? team.find(t => t.id === session.staffId) : null;
  const title = TITLES[currentTab] || ['', ''];
  const heroStats = useHeroStats(currentTab);
  // the assistant (and anything else) can ask the portal to open a screen
  useEffect(() => {
    const h = (e: Event) => { const t = (e as CustomEvent<string>).detail; if (typeof t === 'string' && t) onTabChange(t); };
    window.addEventListener('goto-tab', h);
    return () => window.removeEventListener('goto-tab', h);
  }, [onTabChange]);

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const overdueLeads = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= todayStr && !['Converted', 'Lost'].includes(l.stage)).length;
  const pendingRequests = requests.filter(r => r.status === 'Pending').length;
  const urgentFeedback = clientFeedback.filter(f => f.moneyDemanded && !f.reviewedByCeo).length;
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

  const group = findGroupForTab(currentTab);
  const who = session?.type === 'ceo' ? 'Head Manager' : me?.name || 'Team member';
  const noHero = currentTab === 'hub' || currentTab === 'dashboard';
  const dateText = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Karachi' });

  return (
    <div className="flex min-h-screen">
      <aside
        className="side flex-none flex flex-col sticky top-0 h-screen overflow-y-auto overflow-x-hidden text-[#DCE6F7] no-print"
        style={{ width: collapsed ? 68 : 244, padding: collapsed ? '18px 10px' : '18px 14px', transition: 'width .16s ease, padding .16s ease', boxShadow: '0 20px 50px rgba(14,27,54,.28)' }}
      >
        <div className={`flex items-center pb-4 ${collapsed ? 'flex-col gap-3' : 'gap-2.5 px-1 justify-between'}`}>
          <button onClick={() => onTabChange('hub')} title="All modules" className="flex items-center gap-2.5 text-left min-w-0" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <img src={LOGO_ICON} alt="GoGlobe Consultants" className="w-9 h-9 rounded-[11px] object-cover bg-white flex-none" style={{ boxShadow: '0 6px 18px rgba(0,0,0,.35)' }} />
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display font-semibold text-[16px] text-white leading-tight">GoGlobe Ops</div>
                <div className="text-[10.5px] text-[#8FA6CC] uppercase tracking-[.12em]">Client &amp; Case Portal</div>
              </div>
            )}
          </button>
          {isCeo && (
            <button onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Minimize sidebar'} title={collapsed ? 'Expand sidebar' : 'Minimize sidebar'}
              className="flex-none w-6 h-6 rounded-full flex items-center justify-center text-[11px]"
              style={{ background: 'rgba(255,255,255,.10)', color: '#fff', border: '1px solid rgba(255,255,255,.16)', cursor: 'pointer', padding: 0 }}
            >{collapsed ? '➤' : '◀'}</button>
          )}
        </div>

        {!collapsed && (
          <button onClick={() => openAssistant()} className="mb-3 flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, hsl(262 70% 56%), hsl(222 72% 52%))', border: 'none', cursor: 'pointer', boxShadow: '0 10px 24px -12px hsl(262 80% 60% / .8)' }}>
            <Icon id="assistant" size={17} stroke="#fff" />
            <span className="flex-1">Ask the assistant</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.2)' }}>new</span>
          </button>
        )}

        <nav className="flex flex-col gap-0.5">
          {isCeo ? (
            <>
              <SideLink id="dashboard" label="Dashboard" active={currentTab === 'dashboard'} collapsed={collapsed} onClick={() => onTabChange('dashboard')} />
              {session?.type === 'ceo' && <SideLink id="dailyreport" label="Daily Report" active={currentTab === 'dailyreport'} collapsed={collapsed} onClick={() => onTabChange('dailyreport')} />}
              {sections.map(sec => (
                <div key={sec.id}>
                  {collapsed
                    ? <div className="mx-2 my-2.5" style={{ borderTop: '1px solid rgba(255,255,255,.10)' }} />
                    : (
                      <button onClick={() => onTabChange(sec.groupId)} title={`Open the ${sec.label} overview`}
                        className="w-full text-left px-2.5 pt-4 pb-1.5 text-[10.5px] font-bold uppercase tracking-[.12em] hover:text-white"
                        style={{ color: currentTab === sec.groupId ? '#fff' : 'rgba(255,255,255,.42)', background: 'none', border: 'none', cursor: 'pointer' }}
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
          <button onClick={logout} title="Log out" className="nav-link mt-3" style={{ color: '#F3B8B0', justifyContent: collapsed ? 'center' : undefined }}>
            <span className="nav-ico" style={{ ['--dot' as string]: '#F3B8B0' }}><Icon id="logout" size={15} /></span>
            {!collapsed && 'Log out'}
          </button>
        </nav>

        {!collapsed && (
          <div className="mt-auto pt-3.5 border-t border-white/10 flex items-center gap-2.5 text-[11.5px] text-[#8FA6CC]">
            <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-white flex-none" style={{ background: 'linear-gradient(135deg,#C9922E,#E0B04F)' }}>{initials(who)}</span>
            <div className="min-w-0">
              <b className="text-white block truncate text-[13px]">{who}</b>
              {session?.type === 'ceo' ? 'Full access to every module' : isCeo ? 'Admin access, granted by the Head Manager' : 'You see only your own work'}
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-7 py-3 sticky top-0 z-[5] no-print"
          style={{ borderBottom: '1px solid #E3E9F2', background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-2 text-[13px] text-[var(--muted)] min-w-0">
            <button onClick={() => onTabChange('hub')} className="hover:text-[var(--ink)] font-medium" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Home</button>
            {group && !group.standalone && group.id !== currentTab && (<><span>›</span><button onClick={() => onTabChange(group.id)} className="hover:text-[var(--ink)] font-medium" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>{group.label}</button></>)}
            {currentTab !== 'hub' && (<><span>›</span><b className="text-[var(--ink)] truncate">{title[0]}</b></>)}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-[var(--muted)] max-md:hidden">{dateText}</span>
            {isCeo && topAction}
            <button className="btn btn-sm" onClick={() => openAssistant()} title="Ask the assistant"><span className="inline-flex items-center gap-1.5"><Icon id="assistant" size={14} />Assistant</span></button>
          </div>
        </div>

        <div className="themed stage" style={themeVars(currentTab) as React.CSSProperties} data-tab={currentTab}>
          <div className="px-7 py-6 pb-20 max-w-[1320px] max-md:px-4" key={currentTab}>
            {!noHero && (
              <div className="mb-5 no-print">
                <ModuleHero tab={currentTab} title={title[0]} subtitle={title[1] || themeOf(currentTab).tagline} stats={heroStats} />
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
      <AssistantDock />
    </div>
  );
}

function SideLink({ id, label, active, collapsed, badge, onClick }: { id: string; label: string; active: boolean; collapsed: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} title={collapsed ? label : undefined} className={`nav-link ${active ? 'on' : ''}`}
      style={{ ['--dot' as string]: dotOf(id), justifyContent: collapsed ? 'center' : undefined }}>
      <span className="nav-ico"><Icon id={id} size={15} /></span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!!badge && badge > 0 && (
        collapsed
          ? <span className="absolute top-0.5 right-1 w-2 h-2 rounded-full" style={{ background: '#FF6B5E' }} />
          : <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-none" style={{ background: '#FF6B5E', color: '#fff' }}>{badge}</span>
      )}
    </button>
  );
}
