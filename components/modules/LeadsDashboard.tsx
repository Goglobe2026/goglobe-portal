'use client';
import { useMemo, type ReactNode } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
  THEME, GROUPS, groupStats, totalStats, arrivalsByDay, groupOf, groupLook, groupRank, followState, isFresh, agoText, sortNewest, sourceGroup,
  type CountryGroup, type LeadTab,
} from '@/lib/leadView';
import { dayBefore } from '@/lib/leadView';
import type { Lead, LeadSource } from '@/lib/types';

// The overall Leads dashboard: where every country stands today, what needs
// attention first (UK always on top), how many leads arrived each day, and how
// each ad form is doing.

export type Preset = 'new' | 'due' | 'waiting' | 'unassigned' | 'vip';
const LABEL: Record<CountryGroup, string> = { UK: 'UK', Schengen: 'Schengen', Other: 'Other countries' };
const TAB_OF: Record<CountryGroup, LeadTab> = { UK: 'UK', Schengen: 'Schengen', Other: 'Other' };

function Tile({ label, value, sub, color, onClick, testid }: { label: string; value: ReactNode; sub?: string; color?: string; onClick?: () => void; testid: string }) {
  return (
    <button onClick={onClick} data-testid={testid} style={{ textAlign: 'left', background: '#fff', border: '1px solid #D5DCE6', borderTop: `4px solid ${color || THEME.navy}`, borderRadius: 8, padding: '10px 14px', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#51627A', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || THEME.navy, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#6B7A90', marginTop: 1 }}>{sub}</div>}
    </button>
  );
}

function BandTitle({ children, teal }: { children: ReactNode; teal?: boolean }) {
  return <div style={{ background: teal ? THEME.teal : THEME.navy, color: '#fff', fontWeight: 700, fontSize: 13, padding: '8px 12px', borderRadius: '8px 8px 0 0' }}>{children}</div>;
}
const box: React.CSSProperties = { background: '#fff', border: '1px solid #D5DCE6', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#33445C', background: '#EEF2F7', padding: '7px 10px', textTransform: 'none', letterSpacing: 0, borderBottom: '1px solid #D5DCE6' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #E3E8EF', fontSize: 13 };

export function LeadsDashboard({ leads, leadSources, team, nowMs, todayStr, onGo, onOpenLead, extra }: {
  leads: Lead[]; leadSources: LeadSource[]; team: any[]; nowMs: number; todayStr: string;
  onGo: (tab: LeadTab, preset?: Preset) => void; onOpenLead: (l: Lead) => void; extra?: ReactNode;
}) {
  const by = useMemo(() => groupStats(leads, nowMs, todayStr), [leads, nowMs, todayStr]);
  const all = useMemo(() => totalStats(by), [by]);
  const arrivals = useMemo(() => arrivalsByDay(leads, 14, todayStr), [leads, todayStr]);
  const waiting = useMemo(() => sortNewest(leads.filter(l => l.stage === 'New'), { ukFirst: true }).slice(0, 8), [leads]);
  const overdue = useMemo(() => leads.filter(l => followState(l, todayStr) === 'overdue')
    .sort((a, b) => groupRank(groupOf(a)) - groupRank(groupOf(b)) || a.nextFollowUp.localeCompare(b.nextFollowUp)).slice(0, 8), [leads, todayStr]);
  const sources = useMemo(() => {
    const rows = leadSources.map(s => {
      const mine = leads.filter(l => l.sourceId === s.id);
      const newest = sortNewest(mine)[0];
      const g = sourceGroup(s, leads);
      return {
        s, g, total: mine.length, waiting: mine.filter(l => l.stage === 'New').length, converted: mine.filter(l => l.stage === 'Converted').length,
        week: mine.filter(l => l.createdAt >= dayBefore(todayStr, 6)).length, newest,
      };
    });
    return rows.sort((a, b) => groupRank(a.g) - groupRank(b.g) || b.total - a.total);
  }, [leads, leadSources, todayStr]);
  const nameOf = (id: string) => team.find((t: any) => t.id === id)?.name || 'Unassigned';

  return (
    <div data-testid="leads-dashboard">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, margin: '14px 0' }}>
        <Tile testid="kpi-total" label="All leads" value={all.total} sub={`${all.last7} in the last 7 days`} onClick={() => onGo('all')} />
        <Tile testid="kpi-new" label="New (last 48 h)" value={all.fresh} sub="not touched yet" color={THEME.fresh.line} onClick={() => onGo('all', 'new')} />
        <Tile testid="kpi-waiting" label="Not contacted yet" value={all.waiting} sub="status still New" color="#1F4E79" onClick={() => onGo('all', 'waiting')} />
        <Tile testid="kpi-due" label="Follow-ups due" value={all.due} sub={`${all.overdue} overdue`} color="#B5433A" onClick={() => onGo('all', 'due')} />
        <Tile testid="kpi-unassigned" label="No consultant yet" value={all.unassigned} sub="open leads" color="#9A6700" onClick={() => onGo('all', 'unassigned')} />
        <Tile testid="kpi-converted" label="Became clients" value={all.converted} sub={`${all.conversionPct}% of all leads`} color="#1E6B34" />
      </div>

      <BandTitle>Country by country — UK first</BandTitle>
      <div style={box}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Country</th><th style={th}>Leads</th><th style={th}>New</th><th style={th}>Not contacted</th><th style={th}>Contacted</th>
            <th style={th}>Qualified</th><th style={th}>Clients</th><th style={th}>Conversion</th><th style={th}>Follow-ups due</th><th style={th}>Latest lead</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {GROUPS.map(g => {
              const s = by[g]; const look = groupLook(g);
              const latest = s.latest ? agoText({ receivedAt: s.latest.length > 10 ? s.latest : undefined, createdAt: s.latest.slice(0, 10) }, nowMs, todayStr) : '—';
              return (
                <tr key={g} data-testid={`country-row-${g}`} style={g === 'UK' ? { background: '#FFFBEA' } : undefined}>
                  <td style={{ ...td, boxShadow: `inset 5px 0 0 ${look.solid}`, fontWeight: 700 }}>
                    <span style={{ background: look.bg, color: look.fg, border: `1px solid ${look.line}`, padding: '2px 10px', borderRadius: 999, fontSize: 12.5 }}>{LABEL[g]}</span>
                    {g === 'UK' && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: '#7A5200', letterSpacing: '.06em' }}>PRIORITY</span>}
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.total}</td>
                  <td style={{ ...td, color: THEME.fresh.fg, fontWeight: 700 }}>{s.fresh}</td>
                  <td style={td}>{s.waiting}</td><td style={td}>{s.contacted}</td><td style={td}>{s.qualified}</td>
                  <td style={td}>{s.converted}</td><td style={td}>{s.total ? `${s.conversionPct}%` : '—'}</td>
                  <td style={{ ...td, color: s.due ? '#B5433A' : undefined, fontWeight: s.due ? 700 : 400 }}>{s.due}</td>
                  <td style={{ ...td, color: '#51627A' }}>{latest}</td>
                  <td style={td}><button onClick={() => onGo(TAB_OF[g])} style={{ background: THEME.navy, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, padding: '5px 12px', cursor: 'pointer' }}>Open</button></td>
                </tr>
              );
            })}
            <tr style={{ background: '#EEF2F7', fontWeight: 700 }}>
              <td style={td}>Total</td><td style={td}>{all.total}</td><td style={td}>{all.fresh}</td><td style={td}>{all.waiting}</td><td style={td}>{all.contacted}</td>
              <td style={td}>{all.qualified}</td><td style={td}>{all.converted}</td><td style={td}>{all.total ? `${all.conversionPct}%` : '—'}</td><td style={td}>{all.due}</td><td style={td}></td><td style={td}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, marginTop: 16 }}>
        <div>
          <BandTitle teal>New leads per day — last 14 days</BandTitle>
          <div style={{ ...box, padding: '10px 6px 4px', height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={arrivals} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E8EF" />
                <XAxis dataKey="label" tick={{ fontSize: 10.5 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="UK" stackId="a" fill={THEME.uk.solid} />
                <Bar dataKey="Schengen" stackId="a" fill={THEME.schengen.solid} />
                <Bar dataKey="Other" stackId="a" fill={THEME.other.solid} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <BandTitle teal>Where leads come from — by ad form</BandTitle>
          <div style={box}>
            {!sources.length ? (
              <div style={{ padding: 14, fontSize: 12.5, color: '#51627A' }}>No lead sources yet. Add each ad form under Marketing → Lead Sources and its numbers appear here.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Ad form</th><th style={th}>Leads</th><th style={th}>7 days</th><th style={th}>Waiting</th><th style={th}>Clients</th><th style={th}>Latest</th></tr></thead>
                <tbody>
                  {sources.map(r => (
                    <tr key={r.s.id} data-testid="source-row">
                      <td style={{ ...td, fontWeight: 700, boxShadow: `inset 4px 0 0 ${groupLook(r.g).solid}` }}>{r.s.name}<div style={{ fontWeight: 400, fontSize: 11, color: '#6B7A90' }}>{LABEL[r.g]}{r.s.active === false ? ' · paused' : ''}</div></td>
                      <td style={td}>{r.total}</td><td style={td}>{r.week}</td><td style={td}>{r.waiting}</td><td style={td}>{r.converted}</td>
                      <td style={{ ...td, color: '#51627A' }}>{r.newest ? agoText(r.newest, nowMs, todayStr) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, marginTop: 16 }}>
        <div>
          <BandTitle>Not contacted yet — UK first, newest on top</BandTitle>
          <div style={box} data-testid="list-waiting">
            {!waiting.length ? <div style={{ padding: 14, fontSize: 12.5, color: '#1E6B34' }}>Everyone has been contacted. 🎉</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {waiting.map(l => {
                  const look = groupLook(groupOf(l)); const fresh = isFresh(l, nowMs, todayStr);
                  return (
                    <tr key={l.id} onClick={() => onOpenLead(l)} style={{ cursor: 'pointer', background: fresh ? THEME.fresh.bg : undefined }}>
                      <td style={{ ...td, boxShadow: `inset 4px 0 0 ${look.solid}`, fontWeight: 700 }}>{l.name}{fresh && <span style={{ marginLeft: 6, background: THEME.fresh.line, color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '1px 5px', borderRadius: 4 }}>NEW</span>}</td>
                      <td style={td}><span style={{ background: look.bg, color: look.fg, fontSize: 11.5, fontWeight: 700, padding: '1px 8px', borderRadius: 999 }}>{l.destination || '—'}</span></td>
                      <td style={{ ...td, color: '#51627A' }}>{agoText(l, nowMs, todayStr)}</td>
                      <td style={{ ...td, color: l.assignedTo ? '#33445C' : '#B5433A' }}>{nameOf(l.assignedTo)}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            )}
            {by.UK.waiting + by.Schengen.waiting + by.Other.waiting > waiting.length && (
              <div style={{ padding: '7px 10px', fontSize: 12 }}><button onClick={() => onGo('all', 'waiting')} style={{ background: 'none', border: 'none', color: THEME.teal, fontWeight: 700, cursor: 'pointer', padding: 0 }}>See all {all.waiting} ›</button></div>
            )}
          </div>
        </div>
        <div>
          <BandTitle>Follow-ups overdue — UK first</BandTitle>
          <div style={box} data-testid="list-overdue">
            {!overdue.length ? <div style={{ padding: 14, fontSize: 12.5, color: '#1E6B34' }}>No follow-up is overdue. 🎉</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                {overdue.map(l => {
                  const look = groupLook(groupOf(l));
                  const late = Math.round((Date.parse(todayStr) - Date.parse(l.nextFollowUp)) / 86400000);
                  return (
                    <tr key={l.id} onClick={() => onOpenLead(l)} style={{ cursor: 'pointer' }}>
                      <td style={{ ...td, boxShadow: `inset 4px 0 0 ${look.solid}`, fontWeight: 700 }}>{l.name}</td>
                      <td style={td}><span style={{ background: look.bg, color: look.fg, fontSize: 11.5, fontWeight: 700, padding: '1px 8px', borderRadius: 999 }}>{l.destination || '—'}</span></td>
                      <td style={{ ...td, color: '#B5433A', fontWeight: 700 }}>{late} day{late === 1 ? '' : 's'} late</td>
                      <td style={{ ...td, color: '#33445C' }}>{nameOf(l.assignedTo)}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            )}
            {all.overdue > overdue.length && (
              <div style={{ padding: '7px 10px', fontSize: 12 }}><button onClick={() => onGo('all', 'due')} style={{ background: 'none', border: 'none', color: THEME.teal, fontWeight: 700, cursor: 'pointer', padding: 0 }}>See all {all.due} ›</button></div>
            )}
          </div>
        </div>
      </div>

      {extra && <div style={{ marginTop: 22 }}>{extra}</div>}
    </div>
  );
}
