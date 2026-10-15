'use client';
import { useMemo } from 'react';
import { NAV_GROUPS } from '@/lib/navGroups';
import { useAppData } from '@/lib/AppDataContext';
import { today, money } from '@/lib/constants';
import { themeOf, themeVars, patternImage } from '@/lib/moduleTheme';
import { Icon } from '@/components/ui/icons';
import { moneyHome } from '@/lib/money';
import { useMoneyInput } from './useMoney';
import { useGroupStats } from './groupStats';
import { openAssistant } from './AssistantDock';

function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Karachi' }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function ModuleHub({ onOpen }: { onOpen: (id: string) => void }) {
  const { session, leads, appointments, requests, complaints, team } = useAppData();
  const isHead = session?.type === 'ceo';
  // The daily report carries the firm's money and the WhatsApp connection — Head Manager only.
  const groups = NAV_GROUPS.filter(g => g.id !== 'dailyreport' || isHead);
  const todayStr = today();
  const input = useMoneyInput();
  const mh = useMemo(() => moneyHome(todayStr.slice(0, 7), input, todayStr), [input, todayStr]);

  const me = session?.type === 'employee' ? team.find(t => t.id === session.staffId) : null;
  const who = isHead ? 'Head Manager' : (me?.name || 'there').split(' ')[0];
  const dueLeads = leads.filter(l => l.nextFollowUp && l.nextFollowUp <= todayStr && !['Converted', 'Lost'].includes(l.stage)).length;
  const apptToday = appointments.filter(a => a.date === todayStr && a.status === 'Scheduled').length;
  const pendingReq = requests.filter(r => r.status === 'Pending').length;
  const openComplaints = complaints.filter(c => c.status !== 'Resolved').length;

  const today_: { id: string; icon: string; n: string; text: string; go: string; tone: 'bad' | 'warn' | 'info' }[] = [];
  if (dueLeads) today_.push({ id: 'leads', icon: 'leads', n: String(dueLeads), text: `lead${dueLeads === 1 ? '' : 's'} need a follow-up`, go: 'leads', tone: 'warn' });
  if (apptToday) today_.push({ id: 'appointments', icon: 'appointments', n: String(apptToday), text: `appointment${apptToday === 1 ? '' : 's'} today`, go: 'appointments', tone: 'info' });
  if (mh.lateNow) today_.push({ id: 'billing', icon: 'billing', n: money(mh.lateNow), text: 'is late from clients', go: 'billing', tone: 'bad' });
  if (mh.payoutsOverdue) today_.push({ id: 'payouts', icon: 'payouts', n: money(mh.payoutsOverdue), text: 'should have been paid out', go: 'payouts', tone: 'bad' });
  if (pendingReq) today_.push({ id: 'hr', icon: 'hr', n: String(pendingReq), text: `team request${pendingReq === 1 ? '' : 's'} waiting`, go: 'hr', tone: 'warn' });
  if (openComplaints) today_.push({ id: 'complaints', icon: 'complaints', n: String(openComplaints), text: `open complaint${openComplaints === 1 ? '' : 's'}`, go: 'complaints', tone: 'warn' });
  const toneColor = { bad: 'hsl(4 70% 48%)', warn: 'hsl(32 90% 44%)', info: 'hsl(214 70% 46%)' };

  const t = themeOf('hub');
  return (
    <div>
      <div className="hero rise mb-6" style={{ ['--hero-pattern' as string]: patternImage(t.pattern), padding: '30px 34px' }}>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[.14em]" style={{ opacity: .75 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' })}</div>
            <h1 className="font-display m-0 mt-1 text-[34px] font-semibold leading-tight max-md:text-[26px]">{greeting()}, {who}</h1>
            <div className="mt-1.5 text-[14.5px]" style={{ opacity: .9 }}>
              {isHead && today_.length > 0 ? `${today_.length} thing${today_.length === 1 ? '' : 's'} need${today_.length === 1 ? 's' : ''} you today.` : isHead ? 'Everything is in order today.' : 'Open your portal to see your day.'}
            </div>
          </div>
          <button onClick={() => openAssistant()} className="flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold"
            style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(6px)' }}>
            <Icon id="assistant" size={18} stroke="#fff" />
            Ask the assistant anything
          </button>
        </div>
        {isHead && (
          <div className="flex gap-2.5 flex-wrap mt-5">
            <div className="hero-chip"><b>{money(mh.received)}</b><span>Received this month</span></div>
            <div className="hero-chip"><b>{money(mh.stillOwed)}</b><span>Clients still owe</span></div>
            <div className="hero-chip"><b>{money(mh.spent)}</b><span>Spent this month</span></div>
            <div className="hero-chip"><b>{mh.kept < 0 ? '− ' : ''}{money(Math.abs(mh.kept))}</b><span>What we kept</span></div>
          </div>
        )}
      </div>

      {isHead && today_.length > 0 && (
        <div className="mb-7 rise-2">
          <div className="text-[12px] font-bold uppercase tracking-[.12em] text-[var(--muted)] mb-2.5">Needs you today</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {today_.map(a => (
              <button key={a.id} onClick={() => onOpen(a.go)} data-testid={`today-${a.id}`}
                className="flex items-center gap-3 text-left rounded-2xl bg-white p-3.5 transition-all hover:-translate-y-0.5"
                style={{ border: '1px solid #E3E9F2', boxShadow: '0 8px 24px -16px rgba(20,33,61,.25)', cursor: 'pointer' }}>
                <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-none" style={{ background: `color-mix(in srgb, ${toneColor[a.tone]} 12%, white)`, color: toneColor[a.tone] }}><Icon id={a.icon} size={20} /></span>
                <span className="min-w-0">
                  <b className="font-display block text-[18px] leading-tight" style={{ color: toneColor[a.tone] }}>{a.n}</b>
                  <span className="text-[12.5px] text-[var(--muted)]">{a.text}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-[12px] font-bold uppercase tracking-[.12em] text-[var(--muted)] mb-2.5">Your modules</div>
      <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-md:grid-cols-1">
        {groups.map((g, i) => <GroupCard key={g.id} id={g.id} label={g.label} blurb={g.blurb} onOpen={onOpen} delay={i} />)}
      </div>
    </div>
  );
}

function GroupCard({ id, label, blurb, onOpen, delay }: { id: string; label: string; blurb: string; onOpen: (id: string) => void; delay: number }) {
  const stats = useGroupStats(id).slice(0, 2);
  const tVars = themeVars(id) as React.CSSProperties;
  return (
    <button onClick={() => onOpen(id)} data-testid={`hub-${id}`}
      className="group text-left rounded-[22px] bg-white overflow-hidden transition-all hover:-translate-y-1 rise flex flex-col justify-start items-stretch"
      style={{ ...tVars, border: '1px solid #E3E9F2', boxShadow: '0 1px 2px rgba(20,33,61,.04), 0 14px 30px -20px rgba(20,33,61,.25)', cursor: 'pointer', minHeight: 188, animationDelay: `${delay * 40}ms` }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 24px 44px -22px var(--accent-glow)'; e.currentTarget.style.borderColor = 'var(--accent-line)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(20,33,61,.04), 0 14px 30px -20px rgba(20,33,61,.25)'; e.currentTarget.style.borderColor = '#E3E9F2'; }}
    >
      <div style={{ height: 6, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-12 h-12 rounded-[15px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent-2), var(--accent))', color: '#fff', boxShadow: '0 12px 22px -12px var(--accent-glow)' }}>
            <Icon id={id} size={23} stroke="#fff" width={1.7} />
          </div>
          <span className="text-[18px] transition-transform group-hover:translate-x-1" style={{ color: 'var(--accent)' }}>→</span>
        </div>
        <div className="font-display text-[20px] font-semibold mb-1.5" style={{ color: 'var(--accent-ink)' }}>{label}</div>
        <div className="text-[13px] leading-relaxed text-[var(--muted)]">{blurb}</div>
        {stats.length > 0 && (
          <div className="flex gap-4 mt-4 pt-3.5 flex-wrap" style={{ borderTop: '1px dashed var(--accent-line)' }}>
            {stats.map(s => (
              <div key={s.label} className="min-w-0">
                <div className="font-display text-[16px] font-semibold" style={{ color: s.tone === 'bad' ? 'hsl(4 70% 46%)' : s.tone === 'warn' ? 'hsl(32 88% 40%)' : 'var(--accent-ink)' }}>{s.value}</div>
                <div className="text-[11px] text-[var(--muted)] uppercase tracking-wide font-semibold">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
