'use client';
import { money } from '@/lib/constants';
import { leadPayment } from '@/lib/leadStats';
import { THEME, STATUS_LOOK, groupOf, groupLook, isFresh, followState, cityOf, agoText } from '@/lib/leadView';
import { LEAD_STAGES } from '@/lib/constants';
import type { Lead, LeadSource, Case, Specialty } from '@/lib/types';
import { rankStaff, fitFor, deskOf } from '@/lib/specialty';

// The leads list, laid out like the Go Globe sheet: one row per client, fixed
// columns that fit the screen without sideways scrolling, a coloured status
// cell, and everything else (occupation, notes, messages, escalation…) one
// click away in the details window.

// What a converted lead has paid so far, read from the case with the same phone number.
function PaymentBadge({ lead, cases }: { lead: Lead; cases: Case[] }) {
  const p = leadPayment(lead, cases);
  const tone = p.state === 'Paid in full' ? ['#C6EFCE', '#1E6B34'] : p.state === 'Part paid' ? ['#FFF2CC', '#7F6000'] : p.state === 'Unpaid' ? ['#FCEEEC', '#B5433A'] : ['#EDEDED', '#6B6B6B'];
  return (
    <div style={{ marginTop: 4 }} title={p.charge ? `Charge ${money(p.charge)} · paid ${money(p.paid)}` : 'Open a case for this client to track payment'}>
      <span style={{ background: tone[0], color: tone[1], fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.03em', whiteSpace: 'nowrap' }}>{p.state}</span>
      {p.state === 'Part paid' && <div style={{ fontSize: 10.5, marginTop: 2, color: '#7F6000' }}>{money(p.outstanding)} owed</div>}
    </div>
  );
}

export interface Assignee { id: string; name: string; specialties?: Specialty[] }
export interface LeadsTableProps {
  rows: Lead[];
  startIndex: number;
  showCountry: boolean;
  selected: Set<string>;
  assignable: Assignee[];
  nowMs: number;
  todayStr: string;
  leadSources: LeadSource[];
  cases: Case[];
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (col: string) => void;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onStage: (id: string, stage: Lead['stage']) => void;
  onAssign: (id: string, staffId: string) => void;
  onFollowUp: (id: string, date: string) => void;
  onVip: (id: string) => void;
  onDetails: (l: Lead) => void;
  onConvert: (l: Lead) => void;
  waHref: (l: Lead) => string;
}

const TH: React.CSSProperties = { color: '#fff', fontWeight: 700, fontSize: 12, textAlign: 'left', padding: '10px 6px', borderBottom: 'none', textTransform: 'none', letterSpacing: 0, whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '9px 6px', borderBottom: '1px solid #E3E8EF', verticalAlign: 'middle', fontSize: 13, overflow: 'hidden' };
const pickStyle: React.CSSProperties = { width: '100%', padding: '5px 6px', fontSize: 12.5, borderRadius: 6, border: '1px solid #D5DCE6', background: '#fff', color: '#1B2A41' };

// The people a lead can go to. When nobody has a desk set, a plain list; otherwise the
// destination's specialists first, then all-rounders, then the other desks.
export function AssigneeOptions({ people, destination }: { people: Assignee[]; destination: string }) {
  if (!people.some(t => t.specialties && t.specialties.length)) return <>{people.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</>;
  const ranked = rankStaff(people, destination);
  const desk = deskOf(destination);
  const groups: { label: string; fit: 'specialist' | 'allrounder' | 'other' }[] = [
    { label: desk ? `${desk} desk` : 'Specialists', fit: 'specialist' }, { label: 'All-rounders', fit: 'allrounder' }, { label: 'Other desks', fit: 'other' },
  ];
  return <>{groups.map(g => {
    const list = ranked.filter(t => fitFor(t, destination) === g.fit);
    return list.length ? <optgroup key={g.fit} label={g.label}>{list.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup> : null;
  })}</>;
}

export function LeadsTable(p: LeadsTableProps) {
  const sortMark = (c: string) => (p.sortColumn === c ? (p.sortDirection === 'asc' ? ' ▲' : ' ▼') : '');
  const clickable = (c: string): React.CSSProperties => ({ ...TH, cursor: 'pointer' });
  const allOnPage = p.rows.length > 0 && p.rows.every(l => p.selected.has(l.id));

  return (
    <div style={{ background: '#fff', border: '1px solid #D5DCE6', borderTop: 'none', borderRadius: '0 0 10px 10px', overflowX: 'auto', overflowY: 'hidden' }} data-testid="leads-table">
      <table style={{ tableLayout: 'fixed', width: '100%', minWidth: p.showCountry ? 1060 : 950, borderCollapse: 'collapse' }}>
        <colgroup>
          <col style={{ width: 32 }} />
          <col style={{ width: 36 }} />
          <col />{/* client name takes whatever room is left */}
          {p.showCountry && <col style={{ width: 78 }} />}
          <col style={{ width: 110 }} />
          <col style={{ width: 124 }} />
          <col style={{ width: 136 }} />
          <col style={{ width: 82 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 190 }} />
        </colgroup>
        <thead>
          <tr style={{ background: THEME.navy }}>
            <th style={{ ...TH, background: THEME.navy }}><input type="checkbox" checked={allOnPage} onChange={p.onToggleAll} title="Select this page" style={{ width: 15, height: 15 }} /></th>
            <th style={{ ...TH, background: THEME.navy }}>No.</th>
            <th style={{ ...clickable('name'), background: THEME.navy }} onClick={() => p.onSort('name')}>Client name{sortMark('name')}</th>
            {p.showCountry && <th style={{ ...clickable('destination'), background: THEME.navy }} onClick={() => p.onSort('destination')}>Country{sortMark('destination')}</th>}
            <th style={{ ...clickable('stage'), background: THEME.navy }} onClick={() => p.onSort('stage')}>Lead status{sortMark('stage')}</th>
            <th style={{ ...clickable('consultant'), background: THEME.navy }} onClick={() => p.onSort('consultant')}>Assigned to{sortMark('consultant')}</th>
            <th style={{ ...TH, background: THEME.teal }}>Lead source</th>
            <th style={{ ...TH, background: THEME.teal }}>City</th>
            <th style={{ ...clickable('nextFollowUp'), background: THEME.teal }} onClick={() => p.onSort('nextFollowUp')}>Follow-up{sortMark('nextFollowUp')}</th>
            <th style={{ ...TH, background: THEME.teal }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((l, i) => {
            const fresh = isFresh(l, p.nowMs, p.todayStr);
            const f = followState(l, p.todayStr);
            const g = groupOf(l);
            const look = groupLook(g);
            const st = STATUS_LOOK[l.stage] || STATUS_LOOK.New;
            const src = l.sourceId ? p.leadSources.find(x => x.id === l.sourceId) : undefined;
            const city = cityOf(l);
            const rowBg = fresh ? THEME.fresh.bg : f === 'overdue' ? THEME.overdue.bg : l.isVip ? THEME.vip.bg : '#fff';
            const first: React.CSSProperties = fresh ? { boxShadow: `inset 5px 0 0 ${THEME.fresh.line}` } : {};
            return (
              <tr key={l.id} data-testid="lead-row" data-lead-name={l.name} data-fresh={fresh ? '1' : '0'} data-group={g} data-stage={l.stage} style={{ background: rowBg }}>
                <td style={{ ...TD, ...first }}><input type="checkbox" checked={p.selected.has(l.id)} onChange={() => p.onToggle(l.id)} style={{ width: 15, height: 15 }} /></td>
                <td style={{ ...TD, color: '#6B7A90', textAlign: 'center' }}>{p.startIndex + i + 1}</td>
                <td style={TD}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <button title={l.isVip ? 'Remove VIP' : 'Mark as VIP'} onClick={() => p.onVip(l.id)}
                      style={{ color: l.isVip ? '#C9922E' : '#C5CCD8', fontSize: 15, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 'none' }}>★</button>
                    <button onClick={() => p.onDetails(l)} title="Open the full details"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: THEME.navy, textAlign: 'left', lineHeight: 1.2, whiteSpace: 'normal', wordBreak: 'break-word', minWidth: 0, flex: '0 1 auto' }}>{l.name}</button>
                    {fresh && <span data-testid="new-tag" style={{ background: THEME.fresh.line, color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '2px 6px', borderRadius: 4, letterSpacing: '.05em', flex: 'none' }}>NEW</span>}
                    {l.interestLevel === 'High' && <span title="High interest" style={{ flex: 'none' }}>🔥</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#51627A', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.phone}<span style={{ color: '#95A2B5' }}> · {agoText(l, p.nowMs, p.todayStr)}</span>
                  </div>
                  {l.escalated && !l.escalationResolved && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#B5433A', marginTop: 2 }}>⚑ Escalated</div>}
                </td>
                {p.showCountry && (
                  <td style={TD}>
                    <span data-testid="country-chip" style={{ background: look.bg, color: look.fg, border: `1px solid ${look.line}`, fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{l.destination || '—'}</span>
                  </td>
                )}
                <td style={TD}>
                  <select value={l.stage} onChange={e => p.onStage(l.id, e.target.value as Lead['stage'])}
                    style={{ ...pickStyle, background: st.bg, color: st.fg, fontWeight: 700, border: `1px solid ${st.bg}` }}>
                    {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {l.stage === 'Converted' && <PaymentBadge lead={l} cases={p.cases} />}
                </td>
                <td style={TD}>
                  <select value={l.assignedTo || ''} onChange={e => p.onAssign(l.id, e.target.value)}
                    style={{ ...pickStyle, ...(!l.assignedTo && !['Converted', 'Lost'].includes(l.stage) ? { color: '#B5433A', borderColor: '#E8B4AF' } : {}) }}>
                    <option value="">Unassigned</option>
                    <AssigneeOptions people={p.assignable} destination={l.destination} />
                  </select>
                </td>
                <td style={TD}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 12.5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: look.solid, flex: 'none' }} />{l.source}
                  </div>
                  {l.campaign && <div style={{ fontSize: 11.5, color: '#51627A', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.campaign}>{l.campaign}</div>}
                  {src && <div style={{ fontSize: 10.5, color: '#95A2B5', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Form: {src.name}</div>}
                </td>
                <td style={{ ...TD, color: '#33445C' }}>{city || <span style={{ color: '#B5BFCD' }}>—</span>}</td>
                <td style={TD}>
                  <input type="date" value={l.nextFollowUp || ''} onChange={e => p.onFollowUp(l.id, e.target.value)} style={{ ...pickStyle, fontSize: 12 }} />
                  {f === 'overdue' && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#B5433A', marginTop: 2 }}>Overdue</div>}
                  {f === 'today' && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9A6700', marginTop: 2 }}>Due today</div>}
                </td>
                <td style={TD}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-start', alignItems: 'center' }}>
                    <a href={p.waHref(l)} target="_blank" rel="noreferrer" title="Open WhatsApp with the next follow-up message"
                      style={{ background: '#1FA463', color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 8px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap', flex: 'none' }}>WhatsApp</a>
                    <button onClick={() => p.onConvert(l)} style={{ background: '#fff', color: THEME.navy, border: `1px solid ${THEME.navy}`, fontWeight: 700, fontSize: 12, padding: '5px 7px', borderRadius: 6, cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap' }}>Convert</button>
                    <button onClick={() => p.onDetails(l)} title="Details, messages and more" aria-label="Details"
                      style={{ background: '#fff', color: '#33445C', border: '1px solid #C5CCD8', fontWeight: 700, fontSize: 14, lineHeight: 1, padding: '4px 7px', borderRadius: 6, cursor: 'pointer', flex: 'none' }}>⋯</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
