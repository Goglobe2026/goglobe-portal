'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, money, today } from '@/lib/constants';
import { SectionHead, Stamp } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import { usePerfWatch } from '@/lib/usePerfWatch';
import { trendFor, flaggedDays, DEFAULT_PERF_CONFIG, type PerfConfig, type PerfFlag, type StaffPerf, type PerfHistory } from '@/lib/perfWatch';
import { daysBetween } from '@/lib/finance';
import type { Lead, Case, TeamMember } from '@/lib/types';

// ---------------------------------------------------------------------------
// Performance Watch: who needs attention, and why — in plain words, with the
// numbers behind every flag.
// ---------------------------------------------------------------------------

const TONE = {
  alert: { bg: 'var(--red-50)', fg: 'var(--red)', dot: 'var(--red)' },
  warn: { bg: 'var(--gold-50)', fg: '#8a5a12', dot: 'var(--gold)' },
} as const;

function waLink(phone: string, text: string) {
  const digits = (phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function Tile({ label, value, sub, color, testid }: { label: string; value: string; sub?: string; color?: string; testid?: string }) {
  return (
    <div className="card" style={{ padding: '12px 16px' }} data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[22px] font-bold mt-1" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

// 30 small squares, oldest first: green = on track, gold = watch, red = alert, grey = nothing recorded.
export function TrendStrip({ history, staffId, todayIso, days = 30 }: { history: PerfHistory; staffId: string; todayIso: string; days?: number }) {
  const trend = trendFor(history, staffId, todayIso, days);
  const f = flaggedDays(trend);
  const colour = (s: string | undefined) => (s === 'Alert' ? 'var(--red)' : s === 'Watch' ? 'var(--gold)' : s === 'On track' ? 'var(--navy-light)' : '#E3E6EC');
  return (
    <div data-testid="trend-strip">
      <div className="flex gap-[2px] flex-wrap">
        {trend.map(t => (
          <span key={t.date} title={`${fmtDate(t.date)} — ${t.snap ? t.snap.s : 'not recorded'}`} style={{ width: 9, height: 14, borderRadius: 2, background: colour(t.snap?.s) }} />
        ))}
      </div>
      <div className="text-[11px] text-[var(--muted)] mt-1">
        {f.recorded
          ? <>Last {days} days: <b>{f.alert}</b> on alert, <b>{f.watch}</b> on watch, of {f.recorded} recorded day{f.recorded === 1 ? '' : 's'}.</>
          : 'History starts today — each day is saved automatically.'}
      </div>
    </div>
  );
}

function FlagRow({ flag, leads, cases, showNames }: { flag: PerfFlag; leads: Lead[]; cases: Case[]; showNames: boolean }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[flag.severity];
  const items = (flag.leadIds || []).map(id => leads.find(l => l.id === id)).filter((l): l is Lead => !!l);
  const caseItems = (flag.caseIds || []).map(id => cases.find(c => c.id === id)).filter((c): c is Case => !!c);
  const canOpen = showNames && (items.length > 0 || caseItems.length > 0);
  return (
    <div className="rounded-md px-3 py-2 mb-2" style={{ background: tone.bg }} data-testid={`flag-${flag.code}`} data-severity={flag.severity}>
      <div className="flex items-start gap-2">
        <span className="w-2 h-2 rounded-full mt-[5px] flex-none" style={{ background: tone.dot }} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: tone.fg }}>{flag.title}</div>
          <div className="text-[12px] text-[var(--ink)] opacity-80 mt-0.5">{flag.detail}</div>
        </div>
        {canOpen && <button className="btn btn-sm btn-ghost flex-none" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} list</button>}
      </div>
      {open && (
        <div className="mt-2 ml-4 text-[12px]">
          {items.slice(0, 15).map(l => {
            const waiting = l.createdAt ? daysBetween(l.createdAt, today()) : 0;
            return (
              <div key={l.id} className="flex justify-between gap-3 py-1 border-t first:border-0" style={{ borderColor: 'rgba(0,0,0,.07)' }}>
                <span><b>{l.name || 'Unnamed'}</b> <span className="font-mono-ui text-[11px] text-[var(--muted)]">{l.phone}</span>{l.destination ? <span className="text-[var(--muted)]"> · {l.destination}</span> : null}</span>
                <span className="text-[var(--muted)] whitespace-nowrap">
                  {flag.code === 'overdue' && l.nextFollowUp ? `follow-up was ${fmtDate(l.nextFollowUp)}` : `${waiting} day${waiting === 1 ? '' : 's'} old`}
                </span>
              </div>
            );
          })}
          {caseItems.slice(0, 15).map(c => (
            <div key={c.id} className="flex justify-between gap-3 py-1 border-t first:border-0" style={{ borderColor: 'rgba(0,0,0,.07)' }}>
              <span><b>{c.name}</b> <span className="font-mono-ui text-[11px] text-[var(--muted)]">{c.referenceCode}</span></span>
              <span className="text-[var(--muted)] whitespace-nowrap">
                {flag.code === 'balances' && c.expectedPaymentDate ? `promised ${fmtDate(c.expectedPaymentDate)}` : c.destination}
              </span>
            </div>
          ))}
          {flag.count > Math.max(items.length, caseItems.length) && <div className="text-[var(--muted)] pt-1">…and {flag.count - Math.max(items.length, caseItems.length)} more</div>}
        </div>
      )}
    </div>
  );
}

export function nudgeText(member: TeamMember | undefined, sp: StaffPerf) {
  const first = (member?.name || sp.name).split(' ')[0];
  const lines = sp.flags.map(f => `• ${f.title}`).join('\n');
  return `Assalam o Alaikum ${first},\nA quick note from the office — these need your attention today:\n${lines}\nPlease update them in the portal. Thank you.`;
}

// The panel shown on an employee's HR card / profile.
export function PerfPanel({ staffId, compact = false }: { staffId: string; compact?: boolean }) {
  const { perf, history, todayIso } = usePerfWatch();
  const { leads, cases } = useAppData();
  const sp = perf.staff.find(s => s.staffId === staffId);
  if (!sp) return null;
  return (
    <div className="mb-3" data-testid={`perf-panel-${staffId}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">Performance watch</span>
        <Stamp text={sp.status} />
        {sp.onLeave && <Stamp text="On leave" />}
      </div>
      {sp.flags.length === 0
        ? <div className="text-[12.5px] text-[var(--muted)] mb-2">Nothing flagged — no leads waiting, no missed follow-ups, attendance and targets in order.</div>
        : (compact ? sp.flags.slice(0, 3) : sp.flags).map(f => <FlagRow key={f.code} flag={f} leads={leads} cases={cases} showNames={!compact} />)}
      {compact && sp.flags.length > 3 && <div className="text-[11.5px] text-[var(--muted)] mb-2">+{sp.flags.length - 3} more — open the profile or Performance Watch.</div>}
      <TrendStrip history={history} staffId={staffId} todayIso={todayIso} />
    </div>
  );
}

// What an employee sees for themselves in My Portal.
export function MyPerfCard({ staffId }: { staffId: string }) {
  const { perf, history, todayIso } = usePerfWatch();
  const { leads, cases } = useAppData();
  const sp = perf.staff.find(s => s.staffId === staffId);
  if (!sp) return null;
  const clear = sp.flags.length === 0;
  return (
    <div className="card mb-3.5" data-testid="my-perf" style={clear ? { background: 'var(--green-50)', border: '1px solid var(--navy-light)' } : undefined}>
      <div className="flex items-center gap-2 mb-1.5">
        <b className="font-display text-[14px]">{clear ? 'You are on track' : 'Needs your attention'}</b>
        <Stamp text={sp.status} />
      </div>
      {clear
        ? <div className="text-[12.5px] text-[var(--muted)]">No leads waiting for a first contact, no missed follow-ups. Keep it up.</div>
        : <>
            <div className="text-[12px] text-[var(--muted)] mb-2">These are picked up automatically from your leads, attendance and targets. Fixing them clears them straight away.</div>
            {sp.flags.map(f => <FlagRow key={f.code} flag={f} leads={leads} cases={cases} showNames />)}
          </>}
      <div className="mt-2"><TrendStrip history={history} staffId={staffId} todayIso={todayIso} /></div>
    </div>
  );
}

// A short card for the Dashboard.
export function PerfDashCard() {
  const { perf } = usePerfWatch();
  if (!perf.staff.length) return null;
  const bad = perf.staff.filter(s => s.status !== 'On track');
  return (
    <div className="card" data-testid="dash-perf">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <b className="font-display text-[14px]">Performance watch</b>
        <span className="text-[12px] text-[var(--muted)]">{perf.counts.alert} alert · {perf.counts.watch} watch · {perf.counts.ok} on track — details under HR → Performance Watch</span>
      </div>
      {perf.teamFlags.map(f => (
        <div key={f.code} className="text-[12.5px] py-1.5 border-t" style={{ borderColor: 'var(--line)' }}>
          <span className="w-2 h-2 rounded-full inline-block mr-2" style={{ background: TONE[f.severity].dot }} /><b>{f.title}</b>
        </div>
      ))}
      {bad.length === 0 && perf.teamFlags.length === 0 && <div className="text-[12.5px]" style={{ color: 'var(--green)' }}>Everyone is on track — no leads waiting, no missed follow-ups.</div>}
      {bad.slice(0, 5).map(s => (
        <div key={s.staffId} className="flex items-start gap-2 text-[12.5px] py-1.5 border-t" style={{ borderColor: 'var(--line)' }}>
          <span className="w-[120px] flex-none font-medium">{s.name}</span>
          <Stamp text={s.status} />
          <span className="text-[var(--muted)] flex-1">{s.flags.slice(0, 2).map(f => f.title).join(' · ')}</span>
        </div>
      ))}
      {bad.length > 5 && <div className="text-[11.5px] text-[var(--muted)] pt-1">+{bad.length - 5} more</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The full screen
// ---------------------------------------------------------------------------
export function PerfWatch() {
  const { perf, config, history, todayIso, reload } = usePerfWatch();
  const { team, leads, cases } = useAppData();
  const [showSettings, setShowSettings] = useState(false);
  const [only, setOnly] = useState<'all' | 'flagged'>('all');
  const shown = perf.staff.filter(s => only === 'all' || s.status !== 'On track');

  return (
    <div>
      <SectionHead title="Performance Watch" count="worked out live from leads, attendance and targets" action={
        <button className="btn btn-sm ml-auto" onClick={() => setShowSettings(!showSettings)}>{showSettings ? 'Hide' : 'Change'} the rules</button>
      } />
      <div className="text-[12.5px] text-[var(--muted)] -mt-3 mb-3.5">
        Every flag comes from a simple rule you can see and change — nothing is hidden or guessed. A day&apos;s picture is saved automatically, so each profile also shows how often someone was flagged.
      </div>

      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <Tile testid="tile-alert" label="On alert" value={String(perf.counts.alert)} sub="need action today" color={perf.counts.alert ? 'var(--red)' : undefined} />
        <Tile testid="tile-watch" label="On watch" value={String(perf.counts.watch)} sub="slipping, not yet serious" color={perf.counts.watch ? 'var(--gold)' : undefined} />
        <Tile testid="tile-ok" label="On track" value={String(perf.counts.ok)} sub="nothing flagged" color="var(--green)" />
        <Tile testid="tile-unowned" label="Leads nobody owns" value={String(perf.teamFlags.find(f => f.code === 'unowned')?.count || 0)} sub="no one assigned, or the person left" color={perf.teamFlags.length ? 'var(--red)' : undefined} />
      </div>

      {perf.teamFlags.map(f => (
        <div key={f.code} className="mt-3.5"><FlagRow flag={f} leads={leads} cases={cases} showNames /></div>
      ))}

      {showSettings && <PerfSettings config={config} onSaved={reload} />}

      <div className="flex items-center gap-2 mt-5 mb-1">
        <button className={`btn btn-sm ${only === 'all' ? 'btn-primary' : ''}`} onClick={() => setOnly('all')}>Everyone</button>
        <button className={`btn btn-sm ${only === 'flagged' ? 'btn-primary' : ''}`} onClick={() => setOnly('flagged')}>Only flagged</button>
      </div>

      <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1 mt-3">
        {shown.map(s => <StaffWatchCard key={s.staffId} sp={s} member={team.find(t => t.id === s.staffId)} history={history} todayIso={todayIso} />)}
      </div>
      {!shown.length && <div className="card text-center py-8 text-[var(--muted)]">{perf.staff.length ? 'Nobody is flagged right now.' : 'No active employees to watch yet.'}</div>}

      {perf.oldOpen > 0 && (
        <div className="text-[12px] text-[var(--muted)] mt-4">
          {perf.oldOpen} open lead{perf.oldOpen === 1 ? '' : 's'} are older than {config.lookbackDays} days and are not part of the watch. Close them as lost or converted in Leads, or raise “Only watch leads created in the last…” under the rules.
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md px-2.5 py-1.5" style={{ background: warn ? 'var(--red-50)' : '#F4F6FA' }}>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)] font-semibold">{label}</div>
      <div className="font-mono-ui text-[13px] font-semibold" style={warn ? { color: 'var(--red)' } : undefined}>{value}</div>
    </div>
  );
}

function StaffWatchCard({ sp, member, history, todayIso }: { sp: StaffPerf; member: TeamMember | undefined; history: PerfHistory; todayIso: string }) {
  const { leads, cases } = useAppData();
  const st = sp.stats;
  return (
    <div className="card" data-testid={`watch-${sp.staffId}`} data-status={sp.status}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-display font-semibold text-[15px]">{sp.name}</div>
          <div className="text-[12px] text-[var(--muted)]">{member?.role || sp.department}</div>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap justify-end"><Stamp text={sp.status} />{sp.onLeave && <Stamp text="On leave" />}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatChip label="Open leads" value={String(st.openLeads)} />
        <StatChip label="Untouched" value={String(st.untouched)} warn={st.untouched > 0} />
        <StatChip label="Overdue" value={String(st.overdue)} warn={st.overdue > 0} />
        <StatChip label="Closed / target" value={st.casesTarget ? `${st.closedThisMonth}/${st.casesTarget}` : String(st.closedThisMonth)} />
        <StatChip label="Late / absent" value={`${st.late} / ${st.absent}`} warn={st.absent > 0} />
        <StatChip label="Collected" value={money(st.collectedThisMonth)} />
      </div>
      {sp.flags.length === 0
        ? <div className="text-[12.5px] text-[var(--muted)] mb-2">Nothing flagged.</div>
        : sp.flags.map(f => <FlagRow key={f.code} flag={f} leads={leads} cases={cases} showNames />)}
      <TrendStrip history={history} staffId={sp.staffId} todayIso={todayIso} />
      {member?.phone && sp.flags.length > 0 && (
        <a className="btn btn-sm mt-3 inline-block" href={waLink(member.phone, nudgeText(member, sp))} target="_blank" rel="noreferrer">Remind on WhatsApp</a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The rules, editable
// ---------------------------------------------------------------------------
const GROUPS: { title: string; fields: { key: keyof PerfConfig; label: string; unit: string }[] }[] = [
  {
    title: 'Leads',
    fields: [
      { key: 'untouchedWarnDays', label: 'A new lead nobody has contacted goes on Watch after', unit: 'days' },
      { key: 'untouchedAlertDays', label: '…and on Alert after', unit: 'days' },
      { key: 'untouchedAlertCount', label: '…or on Alert when this many are waiting at once', unit: 'leads' },
      { key: 'overdueWarnDays', label: 'A missed follow-up date counts after', unit: 'days' },
      { key: 'overdueAlertDays', label: '…Alert when the oldest is this late', unit: 'days' },
      { key: 'overdueAlertCount', label: '…or when this many are overdue', unit: 'leads' },
      { key: 'noDateWarnCount', label: 'Contacted leads with no next date: flag from', unit: 'leads' },
      { key: 'unownedWarnDays', label: 'Leads with nobody assigned: flag after', unit: 'days' },
      { key: 'lookbackDays', label: 'Only watch leads created in the last', unit: 'days' },
    ],
  },
  {
    title: 'Attendance',
    fields: [
      { key: 'attendanceDays', label: 'Look back over', unit: 'days' },
      { key: 'lateGraceMinutes', label: 'Grace after shift start', unit: 'minutes' },
      { key: 'lateWarn', label: 'Late arrivals: Watch at', unit: 'times' },
      { key: 'lateAlert', label: '…Alert at', unit: 'times' },
      { key: 'absentWarn', label: 'Absent without leave: Watch at', unit: 'days' },
      { key: 'absentAlert', label: '…Alert at', unit: 'days' },
    ],
  },
  {
    title: 'Targets and results',
    fields: [
      { key: 'paceFromPct', label: 'Start judging targets once this much of the month has passed', unit: '%' },
      { key: 'paceMinPct', label: 'Watch if below this share of where the target should be by now', unit: '%' },
      { key: 'paceAlertPct', label: '…Alert if below', unit: '%' },
      { key: 'declinePct', label: 'Watch if on pace for less than this share of last month', unit: '%' },
      { key: 'conversionMinLeads', label: 'Judge conversion only after this many leads', unit: 'leads' },
      { key: 'lowConversionPct', label: 'Watch if fewer than this share became clients', unit: '%' },
      { key: 'balanceAlertCount', label: 'Client balances past the promised date: Alert at', unit: 'files' },
    ],
  },
];

function PerfSettings({ config, onSaved }: { config: PerfConfig; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const valueOf = (k: keyof PerfConfig) => (draft[k] !== undefined ? draft[k] : String(config[k]));
  const changed = Object.keys(draft);

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, number> = {};
      for (const k of changed) body[k] = Number(draft[k]);
      const r = await fetch('/api/perf-watch', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(j.error || 'Could not save the rules'); return; }
      setDraft({}); await onSaved(); toast('Rules saved — the watch now uses them');
    } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true);
    try {
      const r = await fetch('/api/perf-watch', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) });
      if (!r.ok) { toast('Could not reset'); return; }
      setDraft({}); await onSaved(); toast('Back to the standard rules');
    } finally { setBusy(false); }
  }

  return (
    <div className="card mt-3.5" data-testid="perf-settings">
      <div className="font-display font-semibold text-[14px] mb-1">The rules</div>
      <div className="text-[12px] text-[var(--muted)] mb-3">Change a number and press Save. Everyone&apos;s flags are re-worked straight away. Anyone under these limits is simply “on track”.</div>
      {GROUPS.map(g => (
        <div key={g.title} className="mb-3">
          <div className="text-[11.5px] uppercase tracking-wide font-semibold text-[var(--muted)] mb-1.5">{g.title}</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 max-md:grid-cols-1">
            {g.fields.map(f => (
              <label key={f.key} className="text-[12.5px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: 0 }}>
                <span>{f.label}</span>
                <span className="flex items-center gap-1.5 flex-none">
                  <input data-testid={`cfg-${f.key}`} type="number" className="!w-[72px] font-mono-ui text-right" value={valueOf(f.key)} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} />
                  <span className="text-[11px] text-[var(--muted)] w-[44px]">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <button className="btn btn-primary" disabled={busy || !changed.length} onClick={save}>Save rules</button>
        <button className="btn btn-ghost" disabled={busy} onClick={reset}>Back to standard rules</button>
        {JSON.stringify(config) !== JSON.stringify(DEFAULT_PERF_CONFIG) && <span className="text-[11.5px] text-[var(--muted)] self-center">Some rules differ from the standard ones.</span>}
      </div>
    </div>
  );
}
