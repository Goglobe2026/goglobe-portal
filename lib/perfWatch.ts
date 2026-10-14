import type { Lead, Case, Transaction, TeamMember, AttendanceRecord, EmployeeRequest, StaffTarget, QcCheck, Appointment } from './types';
import { closerOf, casesClosedBy, collectedFor, daysBetween, workingDaysBetween, isWorkingDay, monthEnd, shiftMonth, caseCharge, casePaid } from './finance';
import { latestQc } from './qc';
import { caseDue } from './paymentPlan';

// ---------------------------------------------------------------------------
// Performance watch
//
// Looks at what each employee has really done in the portal and flags what
// needs attention: new leads nobody has contacted, follow-ups that were
// promised and missed, late or absent days, targets that are running behind.
// Everything here is a plain, explainable rule — the screen shows the rule's
// numbers next to every flag, so nobody is judged by a hidden score.
//
// Pure functions: the same code runs in the browser (live screens) and on the
// server (daily snapshots and the WhatsApp report).
// ---------------------------------------------------------------------------

export type Severity = 'alert' | 'warn';
export type PerfStatus = 'On track' | 'Watch' | 'Alert';
export type PerfCode =
  | 'untouched' | 'overdue' | 'nodate' | 'late' | 'absent'
  | 'pace-cases' | 'pace-revenue' | 'decline' | 'conversion' | 'balances' | 'qc' | 'unowned';

export interface PerfConfig {
  untouchedWarnDays: number;   // a new lead nobody has contacted for this many days → Watch
  untouchedAlertDays: number;  // …or this many days → Alert
  untouchedAlertCount: number; // …or this many such leads at once → Alert
  overdueWarnDays: number;     // a promised follow-up date passed by this many days
  overdueAlertDays: number;
  overdueAlertCount: number;
  noDateWarnCount: number;     // contacted leads with no next follow-up date
  lookbackDays: number;        // only leads created in this many days are watched
  unownedWarnDays: number;     // leads with nobody assigned, older than this
  attendanceDays: number;      // days looked at for late / absent
  lateGraceMinutes: number;
  lateWarn: number; lateAlert: number;
  absentWarn: number; absentAlert: number;
  paceFromPct: number;         // start judging targets once this % of the month's working days has passed
  paceMinPct: number;          // Watch when below this % of where the target should be by now
  paceAlertPct: number;        // Alert when below this %
  declinePct: number;          // Watch when on pace for less than this % of last month's closings
  conversionMinLeads: number;  // judge conversion only after this many leads
  lowConversionPct: number;
  balanceAlertCount: number;   // client balances past the promised date → Alert at this many
}

export const DEFAULT_PERF_CONFIG: PerfConfig = {
  untouchedWarnDays: 1, untouchedAlertDays: 3, untouchedAlertCount: 5,
  overdueWarnDays: 1, overdueAlertDays: 3, overdueAlertCount: 5,
  noDateWarnCount: 3,
  lookbackDays: 30,
  unownedWarnDays: 1,
  attendanceDays: 14, lateGraceMinutes: 10,
  lateWarn: 3, lateAlert: 6,
  absentWarn: 1, absentAlert: 3,
  paceFromPct: 40, paceMinPct: 60, paceAlertPct: 25,
  declinePct: 60,
  conversionMinLeads: 20, lowConversionPct: 3,
  balanceAlertCount: 3,
};

// Limits for each setting: [min, max]. Anything outside is pulled back in.
const LIMITS: Record<keyof PerfConfig, [number, number]> = {
  untouchedWarnDays: [0, 30], untouchedAlertDays: [1, 60], untouchedAlertCount: [1, 500],
  overdueWarnDays: [1, 30], overdueAlertDays: [1, 90], overdueAlertCount: [1, 500],
  noDateWarnCount: [1, 500],
  lookbackDays: [3, 365],
  unownedWarnDays: [0, 30],
  attendanceDays: [7, 60], lateGraceMinutes: [0, 60],
  lateWarn: [1, 60], lateAlert: [1, 60],
  absentWarn: [1, 60], absentAlert: [1, 60],
  paceFromPct: [0, 90], paceMinPct: [10, 100], paceAlertPct: [0, 90],
  declinePct: [10, 100],
  conversionMinLeads: [5, 1000], lowConversionPct: [0, 50],
  balanceAlertCount: [1, 500],
};
export const PERF_CONFIG_KEYS = Object.keys(DEFAULT_PERF_CONFIG) as (keyof PerfConfig)[];

// Turn whatever was saved (or sent) into a complete, sane set of settings.
export function cleanPerfConfig(raw: unknown): PerfConfig {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_PERF_CONFIG };
  for (const k of PERF_CONFIG_KEYS) {
    const v = Number(src[k]);
    if (src[k] === undefined || src[k] === null || src[k] === '' || !Number.isFinite(v)) continue;
    const [lo, hi] = LIMITS[k];
    out[k] = Math.min(hi, Math.max(lo, Math.round(v)));
  }
  // A warning must come before an alert.
  if (out.untouchedAlertDays < out.untouchedWarnDays) out.untouchedAlertDays = out.untouchedWarnDays;
  if (out.overdueAlertDays < out.overdueWarnDays) out.overdueAlertDays = out.overdueWarnDays;
  if (out.lateAlert < out.lateWarn) out.lateAlert = out.lateWarn;
  if (out.absentAlert < out.absentWarn) out.absentAlert = out.absentWarn;
  if (out.paceAlertPct > out.paceMinPct) out.paceAlertPct = out.paceMinPct;
  return out;
}

export interface PerfFlag {
  code: PerfCode;
  severity: Severity;
  title: string;        // short: "5 new leads not contacted"
  detail: string;       // one or two sentences, with names and numbers
  count: number;
  leadIds?: string[];   // worst first, at most 60
  caseIds?: string[];
}

export interface PerfStats {
  openLeads: number;
  untouched: number;
  overdue: number;
  noDate: number;
  newThisWeek: number;
  closedThisMonth: number;
  casesTarget: number;
  collectedThisMonth: number;
  revenueTarget: number;
  closedLastMonth: number;
  late: number;
  absent: number;
  leads60: number;
  converted60: number;
  balancesLate: number;
}

export interface StaffPerf {
  staffId: string;
  name: string;
  department: string;
  onLeave: boolean;
  status: PerfStatus;
  alerts: number;
  warns: number;
  points: number;       // for sorting only: alerts weigh more than watches
  flags: PerfFlag[];
  stats: PerfStats;
}

export interface TeamPerf {
  date: string;
  staff: StaffPerf[];         // worst first
  teamFlags: PerfFlag[];      // things that are nobody's fault in particular, e.g. leads with no owner
  counts: { alert: number; watch: number; ok: number };
  oldOpen: number;            // open leads older than the look-back window (not watched)
}

export interface PerfInput {
  team: TeamMember[]; leads: Lead[]; cases: Case[]; transactions: Transaction[];
  attendance: AttendanceRecord[]; requests: EmployeeRequest[]; staffTargets: StaffTarget[]; qcChecks: QcCheck[];
  // Optional: lets a payment plan (half now, half at the appointment) be judged part by part.
  appointments?: Appointment[];
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const names = (list: string[], max = 3) => list.length <= max ? list.join(', ') : `${list.slice(0, max).join(', ')} +${list.length - max} more`;
const toMin = (hhmm: string): number | null => {
  const m = /(\d{1,2}):(\d{2})/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const isOpen = (l: Lead) => l.stage !== 'Converted' && l.stage !== 'Lost';
// The newest sign that someone worked on a lead: a logged contact or a message.
export function leadLastActivity(l: Lead): string {
  const dates = [l.lastContacted, ...(l.messages || []).map(m => m.date)].filter(Boolean) as string[];
  return dates.sort().pop() || '';
}
const leadLabel = (l: Lead) => (l.name || l.phone || 'Unnamed lead').trim();
const ID_CAP = 60;

// ---------------------------------------------------------------------------
// The watch
// ---------------------------------------------------------------------------
export function computePerf(input: PerfInput, todayIso: string, cfgIn?: Partial<PerfConfig>): TeamPerf {
  const cfg = cleanPerfConfig(cfgIn);
  const { team, leads, cases, transactions, attendance, requests, staffTargets, qcChecks } = input;
  const appointments = input.appointments || [];
  const month = todayIso.slice(0, 7);
  const prevMonth = shiftMonth(month, -1);
  const windowStart = addDaysIso(todayIso, -cfg.lookbackDays);

  // Who is watched: people still working here (not resigned / terminated / not yet joined).
  const watched = team.filter(t => (!t.employmentStatus || t.employmentStatus === 'Active' || t.employmentStatus === 'On Leave') && (!t.contractStart || t.contractStart <= todayIso));
  const watchedIds = new Set(watched.map(t => t.id));

  // Month progress, counted in working days (Mon–Sat) up to yesterday.
  const mStart = `${month}-01`;
  const totalWd = workingDaysBetween(mStart, monthEnd(month));
  const yesterday = addDaysIso(todayIso, -1);
  const elapsedWd = yesterday >= mStart ? workingDaysBetween(mStart, yesterday) : 0;
  const fraction = totalWd ? elapsedWd / totalWd : 0;

  // Attendance window: the last N days, not counting today (the day isn't over).
  const attFrom = addDaysIso(todayIso, -cfg.attendanceDays);
  const anyAttendanceInWindow = attendance.some(a => a.date >= attFrom && a.date <= yesterday && !!a.checkIn);

  const leadsByOwner = new Map<string, Lead[]>();
  for (const l of leads) {
    const k = l.assignedTo || '';
    (leadsByOwner.get(k) || leadsByOwner.set(k, []).get(k)!).push(l);
  }

  const staff: StaffPerf[] = watched.map(t => {
    const flags: PerfFlag[] = [];
    const mine = leadsByOwner.get(t.id) || [];
    const open = mine.filter(isOpen);

    // ---- New leads nobody has contacted ----
    const untouchedAll = open
      .filter(l => l.stage === 'New' && !leadLastActivity(l) && l.createdAt && l.createdAt >= windowStart)
      .map(l => ({ l, age: daysBetween(l.createdAt, todayIso) }))
      .filter(x => x.age >= cfg.untouchedWarnDays)
      .sort((a, b) => b.age - a.age);
    if (untouchedAll.length) {
      const oldest = untouchedAll[0];
      const bad = untouchedAll.filter(x => x.age >= cfg.untouchedAlertDays).length;
      const sev: Severity = bad > 0 || untouchedAll.length >= cfg.untouchedAlertCount ? 'alert' : 'warn';
      flags.push({
        code: 'untouched', severity: sev, count: untouchedAll.length,
        title: `${plural(untouchedAll.length, 'new lead')} not contacted yet`,
        detail: `Oldest: ${leadLabel(oldest.l)}, waiting ${plural(oldest.age, 'day')}. Still marked “New” with no call or message logged${untouchedAll.length > 1 ? `: ${names(untouchedAll.map(x => leadLabel(x.l)))}` : ''}.`,
        leadIds: untouchedAll.slice(0, ID_CAP).map(x => x.l.id),
      });
    }
    const untouchedIds = new Set(untouchedAll.map(x => x.l.id));

    // ---- Follow-ups that were promised and missed (leads already counted above are not repeated) ----
    const overdueAll = open
      .filter(l => !untouchedIds.has(l.id) && l.nextFollowUp && l.nextFollowUp < todayIso)
      .map(l => ({ l, late: daysBetween(l.nextFollowUp, todayIso) }))
      .filter(x => x.late >= cfg.overdueWarnDays)
      .sort((a, b) => b.late - a.late);
    if (overdueAll.length) {
      const worst = overdueAll[0];
      const sev: Severity = worst.late >= cfg.overdueAlertDays || overdueAll.length >= cfg.overdueAlertCount ? 'alert' : 'warn';
      flags.push({
        code: 'overdue', severity: sev, count: overdueAll.length,
        title: `${plural(overdueAll.length, 'follow-up')} overdue`,
        detail: `Most overdue: ${leadLabel(worst.l)}, ${plural(worst.late, 'day')} past the date.${overdueAll.length > 1 ? ` Also: ${names(overdueAll.slice(1).map(x => leadLabel(x.l)))}.` : ''}`,
        leadIds: overdueAll.slice(0, ID_CAP).map(x => x.l.id),
      });
    }

    // ---- Contacted leads with no next step planned ----
    const noDate = open.filter(l => (l.stage === 'Contacted' || l.stage === 'Qualified') && !l.nextFollowUp);
    if (noDate.length >= cfg.noDateWarnCount) {
      flags.push({
        code: 'nodate', severity: 'warn', count: noDate.length,
        title: `${plural(noDate.length, 'lead')} with no next follow-up date`,
        detail: `They will never show up as “due”, so they can be forgotten: ${names(noDate.map(leadLabel))}.`,
        leadIds: noDate.slice(0, ID_CAP).map(l => l.id),
      });
    }

    // ---- Attendance ----
    let late = 0, absent = 0;
    if (anyAttendanceInWindow && t.employmentStatus !== 'On Leave') {
      const leaveDays = requests.filter(r => r.staffId === t.id && r.type === 'Leave' && r.status === 'Approved' && r.leaveStartDate && r.leaveEndDate);
      const lateDates: string[] = [], absentDates: string[] = [];
      for (let d = attFrom; d <= yesterday; d = addDaysIso(d, 1)) {
        if (!isWorkingDay(d)) continue;
        if (t.contractStart && d < t.contractStart) continue;
        if (t.lastWorkingDay && d > t.lastWorkingDay) continue;
        const rec = attendance.find(a => a.staffId === t.id && a.date === d);
        if (rec?.checkIn) {
          const start = toMin(t.shiftStart), at = toMin(rec.checkIn);
          if (start !== null && at !== null && at > start + cfg.lateGraceMinutes) { late++; lateDates.push(d); }
          continue;
        }
        if (rec?.onApprovedLeave || leaveDays.some(r => r.leaveStartDate <= d && r.leaveEndDate >= d)) continue;
        absent++; absentDates.push(d);
      }
      if (absent >= cfg.absentWarn) {
        flags.push({
          code: 'absent', severity: absent >= cfg.absentAlert ? 'alert' : 'warn', count: absent,
          title: `${plural(absent, 'day')} absent without leave`,
          detail: `No check-in and no approved leave in the last ${cfg.attendanceDays} days: ${absentDates.slice(-6).map(shortDate).join(', ')}.`,
        });
      }
      if (late >= cfg.lateWarn) {
        flags.push({
          code: 'late', severity: late >= cfg.lateAlert ? 'alert' : 'warn', count: late,
          title: `Late ${late} times`,
          detail: `Checked in after ${t.shiftStart || 'shift start'} (+${cfg.lateGraceMinutes} min) on ${late} of the last ${cfg.attendanceDays} days: ${lateDates.slice(-6).map(shortDate).join(', ')}.`,
        });
      }
    }

    // ---- Targets this month ----
    const target = staffTargets.find(x => x.staffId === t.id && x.month === month);
    const casesTarget = target && target.casesTarget > 0 ? target.casesTarget : (t.department === 'Sales' && t.monthlyQuota > 0 ? t.monthlyQuota : 0);
    const revenueTarget = target && target.revenueTarget > 0 ? target.revenueTarget : 0;
    const closedThisMonth = casesClosedBy(cases, t.id, month).length;
    const closedLastMonth = casesClosedBy(cases, t.id, prevMonth).length;
    const collectedThisMonth = collectedFor(cases, transactions, t.id, month);
    // Someone who joined this month is not held to a full month's target.
    const joinedThisMonth = !!t.contractStart && t.contractStart > mStart;
    const judging = !joinedThisMonth && fraction * 100 >= cfg.paceFromPct && fraction > 0;
    let paceCasesFlagged = false;
    if (judging && casesTarget > 0) {
      const expected = casesTarget * fraction;
      const pct = expected > 0 ? (closedThisMonth / expected) * 100 : 100;
      if (pct < cfg.paceMinPct) {
        paceCasesFlagged = true;
        flags.push({
          code: 'pace-cases', severity: pct < cfg.paceAlertPct ? 'alert' : 'warn', count: closedThisMonth,
          title: `${closedThisMonth} of ${casesTarget} cases closed`,
          detail: `${Math.round(fraction * 100)}% of the month's working days are gone; about ${Math.round(expected * 10) / 10} closings were expected by now.`,
        });
      }
    }
    if (judging && revenueTarget > 0) {
      const expected = revenueTarget * fraction;
      const pct = expected > 0 ? (collectedThisMonth / expected) * 100 : 100;
      if (pct < cfg.paceMinPct) {
        flags.push({
          code: 'pace-revenue', severity: pct < cfg.paceAlertPct ? 'alert' : 'warn', count: Math.round(collectedThisMonth),
          title: `Collected PKR ${Math.round(collectedThisMonth).toLocaleString('en-US')} of ${revenueTarget.toLocaleString('en-US')}`,
          detail: `Revenue target for the month; about PKR ${Math.round(expected).toLocaleString('en-US')} was expected by now.`,
        });
      }
    }
    if (!joinedThisMonth && !paceCasesFlagged && fraction >= 0.5 && closedLastMonth >= 3) {
      const projected = closedThisMonth / fraction;
      if (projected < (closedLastMonth * cfg.declinePct) / 100) {
        flags.push({
          code: 'decline', severity: 'warn', count: closedThisMonth,
          title: `Closings falling: ${closedThisMonth} so far vs ${closedLastMonth} last month`,
          detail: `On pace for about ${Math.round(projected)} this month, against ${closedLastMonth} last month.`,
        });
      }
    }

    // ---- Conversion over the last 60 days ----
    const since60 = addDaysIso(todayIso, -60);
    const recent = mine.filter(l => l.createdAt && l.createdAt >= since60);
    const converted60 = recent.filter(l => l.stage === 'Converted').length;
    if (recent.length >= cfg.conversionMinLeads) {
      const pct = (converted60 / recent.length) * 100;
      if (pct < cfg.lowConversionPct) {
        flags.push({
          code: 'conversion', severity: 'warn', count: converted60,
          title: `Only ${converted60} of ${recent.length} recent leads converted`,
          detail: `${Math.round(pct * 10) / 10}% over the last 60 days — the team's own average is the best yardstick for this.`,
        });
      }
    }

    // ---- Client balances past the promised date, on files this person closed ----
    // A file with a payment plan is late only for the part whose date has passed.
    const lateBal = cases
      .filter(c => closerOf(c) === t.id && c.status !== 'Refused')
      .map(c => {
        const cd = caseDue(c, appointments, todayIso);
        const firstLate = cd.chunks.filter(x => x.status === 'Overdue' && x.due).map(x => x.due).sort()[0];
        return { c, late: firstLate ? daysBetween(firstLate, todayIso) : 0, due: cd.overdue };
      })
      .filter(x => x.due > 0)
      .sort((a, b) => b.late - a.late);
    if (lateBal.length) {
      const total = lateBal.reduce((s, x) => s + x.due, 0);
      flags.push({
        code: 'balances', severity: lateBal.length >= cfg.balanceAlertCount || lateBal[0].late >= 14 ? 'alert' : 'warn', count: lateBal.length,
        title: `${plural(lateBal.length, 'client balance')} past the promised date`,
        detail: `PKR ${Math.round(total).toLocaleString('en-US')} overdue. Longest overdue: ${lateBal[0].c.name}, ${plural(lateBal[0].late, 'day')}.`,
        caseIds: lateBal.slice(0, ID_CAP).map(x => x.c.id),
      });
    }

    // ---- Files that failed the quality check ----
    const failed = cases.filter(c => c.consultant === t.id && c.status === 'Active' && latestQc(qcChecks, c.id)?.result === 'Failed');
    if (failed.length) {
      flags.push({
        code: 'qc', severity: 'warn', count: failed.length,
        title: `${plural(failed.length, 'file')} failed the quality check`,
        detail: `Fix and re-check: ${names(failed.map(c => c.name))}.`,
        caseIds: failed.slice(0, ID_CAP).map(c => c.id),
      });
    }

    const alerts = flags.filter(f => f.severity === 'alert').length;
    const warns = flags.length - alerts;
    const onLeave = t.employmentStatus === 'On Leave' || requests.some(r => r.staffId === t.id && r.type === 'Leave' && r.status === 'Approved' && r.leaveStartDate <= todayIso && r.leaveEndDate >= todayIso);
    return {
      staffId: t.id, name: t.name, department: t.department, onLeave,
      status: alerts ? 'Alert' : warns ? 'Watch' : 'On track', alerts, warns, points: alerts * 3 + warns,
      flags: flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'alert' ? -1 : 1)),
      stats: {
        openLeads: open.length, untouched: untouchedAll.length, overdue: overdueAll.length, noDate: noDate.length,
        newThisWeek: mine.filter(l => l.createdAt && l.createdAt >= addDaysIso(todayIso, -6)).length,
        closedThisMonth, casesTarget, collectedThisMonth, revenueTarget, closedLastMonth, late, absent,
        leads60: recent.length, converted60, balancesLate: lateBal.length,
      },
    } as StaffPerf;
  });

  staff.sort((a, b) => b.points - a.points || b.stats.untouched - a.stats.untouched || a.name.localeCompare(b.name));

  // ---- Leads nobody owns: no employee assigned, or assigned to someone who has left ----
  const teamFlags: PerfFlag[] = [];
  const unowned = leads
    .filter(l => isOpen(l) && l.createdAt && l.createdAt >= windowStart && (!l.assignedTo || !watchedIds.has(l.assignedTo)))
    .map(l => ({ l, age: daysBetween(l.createdAt, todayIso) }))
    .filter(x => x.age >= cfg.unownedWarnDays)
    .sort((a, b) => b.age - a.age);
  if (unowned.length) {
    const left = unowned.filter(x => x.l.assignedTo).length;
    teamFlags.push({
      code: 'unowned', severity: unowned[0].age >= cfg.untouchedAlertDays || unowned.length >= 10 ? 'alert' : 'warn', count: unowned.length,
      title: `${plural(unowned.length, 'lead')} with nobody looking after ${unowned.length === 1 ? 'it' : 'them'}`,
      detail: `Oldest: ${leadLabel(unowned[0].l)}, ${plural(unowned[0].age, 'day')}.${left ? ` ${left} of them belong to someone who no longer works here.` : ' Nobody is assigned.'} Assign them in Leads.`,
      leadIds: unowned.slice(0, ID_CAP).map(x => x.l.id),
    });
  }
  const oldOpen = leads.filter(l => isOpen(l) && l.createdAt && l.createdAt < windowStart).length;

  return {
    date: todayIso, staff, teamFlags, oldOpen,
    counts: {
      alert: staff.filter(s => s.status === 'Alert').length,
      watch: staff.filter(s => s.status === 'Watch').length,
      ok: staff.filter(s => s.status === 'On track').length,
    },
  };
}

// ---------------------------------------------------------------------------
// History: one small snapshot per person per day, kept on the server
// ---------------------------------------------------------------------------
export interface PerfSnap { s: PerfStatus; a: number; w: number; u: number; o: number; c: number }
export type PerfHistory = Record<string, Record<string, PerfSnap>>; // date → staffId → snapshot

export function snapshotOf(p: TeamPerf): Record<string, PerfSnap> {
  const out: Record<string, PerfSnap> = {};
  for (const s of p.staff) out[s.staffId] = { s: s.status, a: s.alerts, w: s.warns, u: s.stats.untouched, o: s.stats.overdue, c: s.stats.closedThisMonth };
  return out;
}

// The last `days` days for one person, oldest first. Days with no snapshot are null.
export function trendFor(history: PerfHistory, staffId: string, todayIso: string, days = 30): { date: string; snap: PerfSnap | null }[] {
  const out: { date: string; snap: PerfSnap | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDaysIso(todayIso, -i);
    out.push({ date: d, snap: history[d]?.[staffId] || null });
  }
  return out;
}

export function flaggedDays(trend: { snap: PerfSnap | null }[]): { watch: number; alert: number; recorded: number } {
  let watch = 0, alert = 0, recorded = 0;
  for (const t of trend) {
    if (!t.snap) continue;
    recorded++;
    if (t.snap.s === 'Alert') alert++; else if (t.snap.s === 'Watch') watch++;
  }
  return { watch, alert, recorded };
}

// ---------------------------------------------------------------------------
// Words for the daily report
// ---------------------------------------------------------------------------
export function perfReportLines(p: TeamPerf): { team: string[]; urgent: string[] } {
  const first = (n: string) => n.split(' ')[0];
  const team: string[] = [];
  const urgent: string[] = [];
  const flagged = p.staff.filter(s => s.status !== 'On track');
  if (!p.staff.length) return { team, urgent };
  if (!flagged.length && !p.teamFlags.length) {
    team.push('Performance watch: everyone on track');
  } else {
    team.push(`Performance watch: ${p.counts.alert} alert, ${p.counts.watch} watch, ${p.counts.ok} on track`);
    for (const s of flagged.filter(x => x.status === 'Alert').slice(0, 3)) {
      urgent.push(`${first(s.name)}: ${s.flags.filter(f => f.severity === 'alert').slice(0, 2).map(f => f.title.charAt(0).toLowerCase() + f.title.slice(1)).join(', ')}`);
    }
    const more = flagged.filter(x => x.status === 'Alert').length - 3;
    if (more > 0) urgent.push(`${more} more staff on alert — see Performance Watch`);
  }
  for (const f of p.teamFlags) urgent.push(f.title.charAt(0).toUpperCase() + f.title.slice(1));
  return { team, urgent };
}
