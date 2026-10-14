'use client';
import { useAppData } from '@/lib/AppDataContext';
import { Field, ModalFoot } from '@/components/ui/Primitives';
import { THEME, STATUS_LOOK, groupOf, groupLook, cityOf } from '@/lib/leadView';
import { fmtDate } from '@/lib/constants';
import type { Lead, LeadSource } from '@/lib/types';

// Everything about one lead that does not need to sit in the list: occupation,
// city, interest, notes and the answers from the ad form, messages, escalation,
// visits and tours. Opened by clicking the client's name or the ⋯ button.

export type DetailAction = 'messages' | 'materials' | 'escalate' | 'resolve' | 'visit' | 'tour';

export function LeadDetails({ lead, leadSources, onAction, onConvert, waHref, onClose }: {
  lead: Lead; leadSources: LeadSource[];
  onAction: (a: DetailAction) => void; onConvert: () => void; waHref: string; onClose: () => void;
}) {
  const { setLeads, team } = useAppData();
  const set = (patch: Partial<Lead>) => setLeads(prev => prev.map(x => (x.id === lead.id ? { ...x, ...patch } : x)));
  const g = groupOf(lead), look = groupLook(g), st = STATUS_LOOK[lead.stage] || STATUS_LOOK.New;
  const src = lead.sourceId ? leadSources.find(s => s.id === lead.sourceId) : undefined;
  const who = team.find((t: any) => t.id === lead.assignedTo)?.name || 'Unassigned';
  const answers = Object.entries(lead.answers || {});
  const btn: React.CSSProperties = { background: '#fff', color: THEME.navy, border: `1px solid ${THEME.navy}`, fontWeight: 700, fontSize: 12.5, padding: '7px 12px', borderRadius: 6, cursor: 'pointer' };

  return (
    <div data-testid="lead-details">
      <div style={{ background: THEME.navy, color: '#fff', margin: '-24px -24px 16px', padding: '16px 24px', borderRadius: '16px 16px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{lead.name}</div>
          <span style={{ background: look.bg, color: look.fg, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>{lead.destination || '—'}</span>
          <span style={{ background: st.bg, color: st.fg, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>{lead.stage}</span>
        </div>
        <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>{lead.phone} · {lead.source}{lead.campaign ? ` · ${lead.campaign}` : ''}{src ? ` · Form: ${src.name}` : ''}</div>
        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.75 }}>Came in {fmtDate(lead.createdAt)} · assigned to {who}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <a href={waHref} target="_blank" rel="noreferrer" style={{ background: '#1FA463', color: '#fff', fontWeight: 700, fontSize: 12.5, padding: '8px 14px', borderRadius: 6, textDecoration: 'none' }}>WhatsApp</a>
        <button style={btn} onClick={onConvert}>Convert to client</button>
        <button style={btn} onClick={() => onAction('messages')}>Messages ({lead.messages.length})</button>
        <button style={btn} onClick={() => onAction('materials')}>Send materials</button>
        <button style={btn} onClick={() => onAction('visit')}>Schedule visit</button>
        <button style={btn} onClick={() => onAction('tour')}>Add to tour</button>
        {!lead.escalated || lead.escalationResolved
          ? <button style={btn} onClick={() => onAction('escalate')}>Escalate</button>
          : <button style={{ ...btn, color: '#B5433A', borderColor: '#B5433A' }} onClick={() => onAction('resolve')}>Mark escalation resolved</button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Occupation / business"><input value={lead.occupation || ''} placeholder="Occupation" onChange={e => set({ occupation: e.target.value })} /></Field>
        <Field label="City"><input value={cityOf(lead)} placeholder="City" onChange={e => set({ city: e.target.value })} /></Field>
        <Field label="Interest level">
          <select value={lead.interestLevel || 'Unrated'} onChange={e => set({ interestLevel: e.target.value as Lead['interestLevel'] })}>
            <option value="Unrated">Unrated</option><option value="High">🔥 High</option><option value="Medium">Medium</option><option value="Low">Low</option>
          </select>
        </Field>
        <Field label="VIP">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, fontSize: 13 }}>
            <input type="checkbox" checked={!!lead.isVip} onChange={() => set({ isVip: !lead.isVip })} /> Mark as VIP (gold star in the list)
          </label>
        </Field>
      </div>

      {answers.length > 0 && (
        <div style={{ border: '1px solid #D5DCE6', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ background: THEME.teal, color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>What they answered on the ad form</div>
          {answers.map(([q, a]) => (
            <div key={q} style={{ display: 'flex', gap: 10, padding: '6px 10px', borderTop: '1px solid #E3E8EF', fontSize: 12.5 }}>
              <div style={{ width: 170, color: '#51627A', flex: 'none' }}>{q}</div><div style={{ fontWeight: 600 }}>{a}</div>
            </div>
          ))}
        </div>
      )}

      <Field label="Notes">
        <textarea rows={4} value={lead.notes || ''} onChange={e => set({ notes: e.target.value })} placeholder="Anything worth remembering about this client" />
      </Field>
      {lead.lostReason && <div style={{ fontSize: 12.5, color: '#6B6B6B', marginBottom: 8 }}>Lost because: {lead.lostReason}</div>}
      {lead.escalated && <div style={{ fontSize: 12.5, color: '#B5433A', marginBottom: 8 }}>⚑ Escalated{lead.escalationResolved ? ' (resolved)' : ''}: {lead.escalationReason}</div>}
      <ModalFoot><button className="btn btn-primary" style={{ background: THEME.navy }} onClick={onClose}>Done</button></ModalFoot>
    </div>
  );
}
