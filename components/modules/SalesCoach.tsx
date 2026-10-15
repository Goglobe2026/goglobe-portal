'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { fmtDate, genId, today } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';
import type { Lead } from '@/lib/types';
import {
  CADENCE, FOLLOW_UP_RULES, CONVERSION, GUIDE, WEEK_PLAN, DAILY_HABITS, BENEFITS, TIPS, QUICK_QUESTIONS, POST_KINDS, POST_COUNTRIES,
  tipOfDay, postOfTheDay, buildPost, coachQueue, scriptFor, fill, outboundCount, bracket,
  type CoachAction, type PostKind, type PostLang, type GuideReply,
} from '@/lib/coach';
import { deskOf } from '@/lib/specialty';

// The Sales Coach: what to do next with each lead, the steps for following up and converting,
// the weekly marketing routine, ready-made posts, and an assistant to ask when confused.

const NAVY = '#14213D';
const GREEN = '#0B6E4F';
const RED = '#B5433A';
const AMBER = '#8a5a12';
const box: CSSProperties = { border: '1px solid var(--line)', borderRadius: 14, background: '#fff', padding: 16, marginBottom: 14 };
const h3: CSSProperties = { fontSize: 15, fontWeight: 700, color: NAVY, margin: '0 0 8px' };
const muted: CSSProperties = { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 };
const URG: Record<string, { bg: string; fg: string; label: string }> = {
  now: { bg: '#FDECEA', fg: RED, label: 'DO NOW' },
  today: { bg: '#FFF4DB', fg: AMBER, label: 'TODAY' },
  soon: { bg: '#EAF1FA', fg: '#1F4E79', label: 'SOON' },
};
const waLink = (phone: string, text: string) => `https://wa.me/${(phone || '').replace(/[^0-9]/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(text)}`;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

type TabId = 'today' | 'followup' | 'convert' | 'marketing' | 'posts' | 'ask';
const TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: 'My next actions' }, { id: 'followup', label: 'Follow-up steps' }, { id: 'convert', label: 'Convert a lead' },
  { id: 'marketing', label: 'Marketing routine' }, { id: 'posts', label: 'Posts' }, { id: 'ask', label: 'Ask the coach' },
];

function useCopy() {
  const toast = useToast();
  return async (text: string, done = 'Copied') => {
    try { await navigator.clipboard.writeText(text); toast(done); }
    catch {
      try { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast(done); }
      catch { toast('Could not copy — select the text and copy it by hand'); }
    }
  };
}

export function SalesCoach({ admin = false }: { admin?: boolean }) {
  const { session, team, leads } = useAppData();
  const staffId = session?.type === 'employee' ? session.staffId : '';
  const me = team.find(t => t.id === staffId);
  const [tab, setTab] = useState<TabId>('today');
  const [askSeed, setAskSeed] = useState<{ text: string; leadId?: string; n: number } | null>(null);
  const todayStr = today();
  const tip = tipOfDay(todayStr);

  const queue = useMemo(() => (staffId ? coachQueue(leads, staffId, todayStr, Date.now(), 15) : null), [leads, staffId, todayStr]);
  const sales = team.filter(t => t.department === 'Sales' && (!t.employmentStatus || t.employmentStatus === 'Active'));
  const teamRows = useMemo(() => sales.map(t => ({ t, q: coachQueue(leads, t.id, todayStr, Date.now(), 0) })), [leads, team, todayStr]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pill = (on: boolean): CSSProperties => ({ padding: '7px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999, border: `1px solid ${on ? NAVY : 'var(--line)'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : NAVY, cursor: 'pointer' });
  function askAbout(text: string, leadId?: string) { setAskSeed({ text, leadId, n: Date.now() }); setTab('ask'); }

  return (
    <div data-testid="sales-coach">
      <div style={{ ...box, background: 'linear-gradient(135deg,#14213D,#1B3358)', border: 'none', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontSize: 11, letterSpacing: '.08em', opacity: 0.75, fontWeight: 700 }}>SALES COACH{me ? ` · ${me.name.toUpperCase()}` : ''}</div>
            <div style={{ fontSize: 17, fontWeight: 700, margin: '4px 0 2px' }} data-testid="coach-tip-title">Tip of the day — {tip.title}</div>
            <div style={{ fontSize: 13.5, opacity: 0.92, lineHeight: 1.5 }}>{tip.body}</div>
          </div>
          {queue && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              {([['now', queue.now], ['today', queue.today], ['soon', queue.soon]] as const).map(([k, n]) => (
                <div key={k} data-testid={`coach-count-${k}`} style={{ background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 78 }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.05em', opacity: 0.85 }}>{URG[k].label}</div>
                </div>))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }} role="tablist">
        {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} data-testid={`coach-tab-${t.id}`} style={pill(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'today' && <TodayTab admin={admin} queue={queue} teamRows={teamRows} agentName={me?.name || ''} onAsk={askAbout} />}
      {tab === 'followup' && <FollowUpTab agentName={me?.name || 'your consultant'} />}
      {tab === 'convert' && <ConvertTab />}
      {tab === 'marketing' && <MarketingTab staffId={staffId || 'admin'} todayStr={todayStr} />}
      {tab === 'posts' && <PostsTab admin={admin} agentName={me?.name || ''} phone={me?.phone || ''} />}
      {tab === 'ask' && <AskTab admin={admin} staffId={staffId} seed={askSeed} />}
    </div>
  );
}

// ---------- my next actions ----------
function TodayTab({ admin, queue, teamRows, agentName, onAsk }: {
  admin: boolean; queue: ReturnType<typeof coachQueue> | null; teamRows: { t: { id: string; name: string }; q: ReturnType<typeof coachQueue> }[]; agentName: string; onAsk: (text: string, leadId?: string) => void;
}) {
  const { leads, setLeads, followUpTemplates } = useAppData();
  const toast = useToast();
  const copy = useCopy();
  const [open, setOpen] = useState<string | null>(null);
  const todayStr = today();
  const leadOf = (id: string) => leads.find(l => l.id === id) as Lead;
  // "I have contacted them": record the contact (as the WhatsApp queue does) and set the next follow-up date.
  const setNext = (id: string, days: number) => {
    setLeads(prev => prev.map(l => (l.id === id
      ? { ...l, lastContacted: todayStr, nextFollowUp: addDays(todayStr, days), messages: [...(l.messages || []), { date: todayStr, text: 'Followed up (Sales Coach)', direction: 'Out' as const, responded: null }] }
      : l)));
    toast(`Contact logged — next follow-up ${fmtDate(addDays(todayStr, days))}`);
  };

  return (
    <>
      {admin && (
        <div style={box} data-testid="coach-team">
          <div style={h3}>Your sales team — leads that need action</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
              <thead><tr>{['Agent', 'Do now', 'Today', 'Soon'].map((h, i) => <th key={h} style={{ background: NAVY, color: '#fff', padding: '8px 10px', fontSize: 12, textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {teamRows.map(r => (
                  <tr key={r.t.id}><td style={{ padding: '8px 10px', borderBottom: '1px solid #E3E8EF', fontWeight: 600 }}>{r.t.name}</td>
                    {[r.q.now, r.q.today, r.q.soon].map((n, i) => <td key={i} style={{ padding: '8px 10px', borderBottom: '1px solid #E3E8EF', textAlign: 'right', color: i === 0 && n > 0 ? RED : undefined, fontWeight: n ? 700 : 400 }}>{n}</td>)}</tr>))}
                {!teamRows.length && <tr><td colSpan={4} style={{ padding: 12, ...muted }}>No active sales staff.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ ...muted, marginTop: 8 }}>Each agent sees their own list of next actions in their portal. “Do now” = new leads nobody has contacted, escalations, follow-ups 3+ days late.</div>
        </div>
      )}
      {!admin && queue && (
        <div style={box}>
          <div style={h3}>What to do next{queue.total > queue.items.length ? ` — top ${queue.items.length} of ${queue.total}` : ''}</div>
          {!queue.items.length && <div data-testid="coach-empty" style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>Nothing urgent. Every open lead has a follow-up date in the future — use the time to post today’s post or ask old clients for referrals.</div>}
          {queue.items.map(a => {
            const l = leadOf(a.leadId); if (!l) return null;
            const script = scriptFor(l, a.kind, agentName || 'your consultant', followUpTemplates);
            const u = URG[a.urgency];
            return (
              <div key={a.leadId} data-testid="coach-item" data-urgency={a.urgency} data-lead={a.leadId} style={{ border: '1px solid var(--line)', borderLeft: `4px solid ${u.fg}`, borderRadius: 10, padding: '10px 12px', marginBottom: 9, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 260px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ background: u.bg, color: u.fg, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '.04em' }}>{u.label}</span>
                      <b style={{ fontSize: 14.5, color: NAVY }}>{a.name}</b><span style={muted}>{a.destination}{l.isVip ? ' · ★ VIP' : ''}</span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, margin: '5px 0 2px' }}>{a.title}</div>
                    <div style={muted}>{a.why}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a className="btn btn-sm" style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff' }} target="_blank" rel="noreferrer" href={waLink(l.phone, script)} data-testid="coach-wa">WhatsApp</a>
                    <button className="btn btn-sm" onClick={() => copy(script, 'Message copied')} data-testid="coach-copy">Copy message</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setOpen(open === a.leadId ? null : a.leadId)} data-testid="coach-how">{open === a.leadId ? 'Hide steps' : 'How?'}</button>
                  </div>
                </div>
                {open === a.leadId && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line)' }} data-testid="coach-steps">
                    <ol style={{ margin: '0 0 8px 18px', padding: 0, fontSize: 13, lineHeight: 1.6 }}>{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                    <div style={{ background: '#F6F8FB', borderRadius: 8, padding: '8px 10px', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{script}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                      <span style={muted}>Done contacting them? Log it and set the next follow-up:</span>
                      {[1, 3, 7].map(n => <button key={n} className="btn btn-sm" data-testid={`coach-next-${n}`} onClick={() => setNext(a.leadId, n)}>+{n} day{n === 1 ? '' : 's'}</button>)}
                      <button className="btn btn-sm btn-ghost" onClick={() => onAsk(`What should I say to this ${l.destination} lead? ${a.title}.`, a.leadId)}>Ask the coach</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!admin && !queue && <div style={box}>Your staff record was not found — please log out and in again.</div>}
    </>
  );
}

// ---------- follow-up steps ----------
function FollowUpTab({ agentName }: { agentName: string }) {
  const copy = useCopy();
  return (
    <>
      <div style={box}>
        <div style={h3}>The follow-up routine — the same for every lead</div>
        <div style={{ ...muted, marginBottom: 10 }}>Each time you speak to a lead, set the next follow-up date in “My leads”. These are the steps and the day each one falls on.</div>
        {CADENCE.map(c => (
          <div key={c.n} data-testid="cadence-step" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginBottom: 9 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: NAVY, color: '#fff', borderRadius: 999, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700 }}>{c.n}</span>
              <b style={{ color: NAVY }}>{c.title}</b>
              <span style={{ background: '#EAF1FA', color: '#1F4E79', fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>{c.when}</span>
            </div>
            <div style={{ fontSize: 13, margin: '6px 0 4px', fontWeight: 600 }}>Goal: <span style={{ fontWeight: 400 }}>{c.goal}</span></div>
            <ul style={{ margin: '0 0 8px 18px', padding: 0, fontSize: 13, lineHeight: 1.6 }}>{c.do.map((d, i) => <li key={i}>{d}</li>)}</ul>
            <div style={{ background: '#F6F8FB', borderRadius: 8, padding: '8px 10px', fontSize: 13, lineHeight: 1.5 }}>{fill(c.say, { name: '[name]', destination: '[country]', agent: agentName })}</div>
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={() => copy(fill(c.say, { name: '[name]', destination: '[country]', agent: agentName }), 'Message copied')}>Copy message</button>
          </div>
        ))}
      </div>
      <div style={box}>
        <div style={h3}>Rules that keep leads happy</div>
        <ul style={{ margin: '0 0 0 18px', padding: 0, fontSize: 13.5, lineHeight: 1.7 }}>{FOLLOW_UP_RULES.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </div>
    </>
  );
}

// ---------- convert a lead ----------
function ConvertTab() {
  const copy = useCopy();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <div style={box}>
        <div style={h3}>From enquiry to client — seven steps</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {CONVERSION.map(s => (
            <div key={s.n} data-testid="convert-step" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ background: GREEN, color: '#fff', borderRadius: 999, width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{s.n}</span><b style={{ color: NAVY, fontSize: 13.5 }}>{s.title}</b></div>
              <div style={{ ...muted, margin: '4px 0 6px' }}>{s.why}</div>
              <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 12.5, lineHeight: 1.55 }}>{s.check.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>))}
        </div>
      </div>
      <div style={box}>
        <div style={h3}>When the client hesitates — what to say</div>
        {GUIDE.filter(g => g.steps || g.say).map(g => (
          <div key={g.id} data-testid="objection" style={{ border: '1px solid var(--line)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
            <button type="button" onClick={() => setOpenId(openId === g.id ? null : g.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: '#F8FAFC', border: 'none', cursor: 'pointer', fontWeight: 700, color: NAVY, fontSize: 13.5 }}>{openId === g.id ? '▾' : '▸'} {g.title}</button>
            {openId === g.id && (
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>{g.body}</div>
                {g.steps && <ol style={{ margin: '0 0 8px 18px', padding: 0, fontSize: 13, lineHeight: 1.6 }}>{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
                {g.say && <><div style={{ background: '#F6F8FB', borderRadius: 8, padding: '8px 10px', fontSize: 13, lineHeight: 1.5 }}>{bracket(g.say)}</div>
                  <button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={() => copy(bracket(g.say as string), 'Message copied')}>Copy message</button></>}
              </div>)}
          </div>))}
      </div>
    </>
  );
}

// ---------- marketing routine ----------
function MarketingTab({ staffId, todayStr }: { staffId: string; todayStr: string }) {
  const key = `goglobe_coach_habits_${staffId}_${todayStr}`;
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(v)) setDone(v); } catch { /* no storage */ } }, [key]);
  const toggle = (i: number) => setDone(prev => { const next = prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]; try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  const dow = new Date(todayStr + 'T00:00:00Z').getUTCDay();   // 0 = Sunday
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow];
  return (
    <>
      <div style={box}>
        <div style={h3}>Why this matters</div>
        <ul style={{ margin: '0 0 0 18px', padding: 0, fontSize: 13.5, lineHeight: 1.7 }}>{BENEFITS.map((b, i) => <li key={i}>{b}</li>)}</ul>
      </div>
      <div style={box}>
        <div style={h3}>Today’s habits <span style={{ ...muted, fontWeight: 400 }}>— {done.length} of {DAILY_HABITS.length} done</span></div>
        {DAILY_HABITS.map((h, i) => (
          <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 13.5, cursor: 'pointer', margin: 0, textDecoration: done.includes(i) ? 'line-through' : 'none', color: done.includes(i) ? 'var(--muted)' : undefined }}>
            <input type="checkbox" className="!w-auto" checked={done.includes(i)} onChange={() => toggle(i)} data-testid={`habit-${i}`} />{h}
          </label>))}
        <div style={{ ...muted, marginTop: 6 }}>Ticks are kept on this device for today only.</div>
      </div>
      <div style={box}>
        <div style={h3}>The weekly marketing plan</div>
        {WEEK_PLAN.map(d => (
          <div key={d.day} data-testid="week-day" style={{ borderLeft: `3px solid ${d.day === todayName ? GREEN : 'var(--line)'}`, padding: '4px 0 4px 12px', marginBottom: 10, background: d.day === todayName ? '#F2F8F5' : undefined }}>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: 13.5 }}>{d.day}{d.day === todayName ? ' — today' : ''} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {d.focus}</span></div>
            <ul style={{ margin: '3px 0 0 18px', padding: 0, fontSize: 13, lineHeight: 1.6 }}>{d.do.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>))}
      </div>
      <div style={box}>
        <div style={h3}>More marketing tips</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {TIPS.slice(0, 12).map(t => <div key={t.title} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px' }}><div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t.title}</div><div style={{ ...muted, marginTop: 2 }}>{t.body}</div></div>)}
        </div>
      </div>
    </>
  );
}

// ---------- posts ----------
function PostsTab({ admin, agentName, phone }: { admin: boolean; agentName: string; phone: string }) {
  const { setAnnouncements, logActivity, session } = useAppData();
  const toast = useToast();
  const copy = useCopy();
  const todayStr = today();
  const [lang, setLang] = useState<PostLang>('English');
  const daily = postOfTheDay(todayStr, lang, agentName, phone);
  const [dest, setDest] = useState(daily.destination);
  const [kind, setKind] = useState<PostKind>(daily.kind);
  const [text, setText] = useState(daily.text);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const regen = (d = dest, k = kind, l = lang) => { setText(buildPost({ destination: d, kind: k, lang: l, agentName, phone })); setNote(''); };

  async function improve() {
    setBusy(true); setNote('');
    try {
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'post', question: text, destination: dest, lang }) });
      const j = await r.json();
      if (!r.ok) { setNote(j.error || 'Could not improve the post'); }
      else { if (j.source === 'ai') setText(j.answer); setNote(j.note || (j.source === 'ai' ? 'Improved by the AI assistant — read it before you post.' : '')); }
    } catch { setNote('Could not reach the server'); }
    setBusy(false);
  }
  function sendToTeam() {
    if (!window.confirm(`Send this post to every sales agent? It appears at the top of their portal.`)) return;
    setAnnouncements(prev => [...prev, { id: genId('an'), date: todayStr, title: `Post of the day — ${dest}`, body: `Copy this and post it on your WhatsApp Status or groups:\n\n${text}`, audience: 'Sales', pinned: false, createdBy: 'Sales Coach' }]);
    logActivity(`Post of the day sent to the sales team — ${dest}`);
    toast('Sent to the sales team');
  }
  const sel: CSSProperties = { width: '100%' };
  return (
    <>
      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={h3}>Post of the day — {daily.destination}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['English', 'Roman Urdu'] as PostLang[]).map(l => <button key={l} data-testid={`post-lang-${l === 'English' ? 'en' : 'ur'}`} className="btn btn-sm" aria-pressed={lang === l} style={lang === l ? { background: NAVY, color: '#fff', borderColor: 'transparent' } : {}} onClick={() => { setLang(l); const d = postOfTheDay(todayStr, l, agentName, phone); setDest(d.destination); setKind(d.kind); setText(d.text); setNote(''); }}>{l}</button>)}
          </div>
        </div>
        <div style={{ ...muted, marginBottom: 10 }}>The same ready-made post for the whole team, new every day. Change the country or type below to make your own.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
          <div><label className="text-[11.5px]">Country</label>
            <select data-testid="post-dest" style={sel} value={dest} onChange={e => { setDest(e.target.value); regen(e.target.value, kind, lang); }}>{POST_COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="text-[11.5px]">Type of post</label>
            <select data-testid="post-kind" style={sel} value={kind} onChange={e => { setKind(e.target.value as PostKind); regen(dest, e.target.value as PostKind, lang); }}>{POST_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
        </div>
        <textarea data-testid="post-text" rows={12} value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', fontSize: 13.5, lineHeight: 1.55 }} />
        <div style={{ ...muted, margin: '4px 0 8px' }}>{POST_KINDS.find(k => k.id === kind)?.note}. Edit anything you like before posting.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" data-testid="post-copy" onClick={() => copy(text, 'Post copied — paste it in WhatsApp Status or your group')}>Copy post</button>
          <a className="btn btn-sm" style={{ background: 'linear-gradient(135deg,#1FA463,#0B6E4F)', color: '#fff' }} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`} data-testid="post-wa">Share on WhatsApp</a>
          <button className="btn btn-sm" data-testid="post-new" onClick={() => regen()}>Start again</button>
          <button className="btn btn-sm" data-testid="post-ai" disabled={busy} onClick={improve}>{busy ? 'Improving…' : '✨ Improve with AI'}</button>
          {admin && <button className="btn btn-sm" data-testid="post-team" style={{ background: '#C9922E', color: '#fff', borderColor: 'transparent' }} onClick={sendToTeam}>Send to the sales team</button>}
        </div>
        {note && <div data-testid="post-note" style={{ ...muted, marginTop: 8, color: AMBER }}>{note}</div>}
        <div style={{ ...muted, marginTop: 10 }}>Never post a client’s name, photo or documents without their permission, and never promise a visa.</div>
      </div>
    </>
  );
}

// ---------- ask the coach ----------
interface Msg { role: 'user' | 'assistant'; text?: string; guide?: GuideReply[]; source?: 'ai' | 'guide'; note?: string }
function AskTab({ admin, staffId, seed }: { admin: boolean; staffId: string; seed: { text: string; leadId?: string; n: number } | null }) {
  const { leads } = useAppData();
  const copy = useCopy();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [status, setStatus] = useState<{ ai: boolean; provider: string | null } | null>(null);
  const seen = useRef(0);
  const mine = leads.filter(l => l.assignedTo === staffId && !['Converted', 'Lost'].includes(l.stage));

  useEffect(() => { fetch('/api/coach').then(r => r.json()).then(setStatus).catch(() => setStatus({ ai: false, provider: null })); }, []);
  const thread = useRef<HTMLDivElement>(null);
  // keep the latest question (and the start of its answer) in view, not the end of a long answer
  useEffect(() => {
    const t = thread.current; if (!t) return;
    const users = t.querySelectorAll('[data-testid=coach-user]');
    const last = users[users.length - 1] as HTMLElement | undefined;
    if (last) t.scrollTop = Math.max(0, last.offsetTop - t.offsetTop - 4);
  }, [msgs, busy]);

  function contextOf(id: string) {
    const l = leads.find(x => x.id === id); if (!l) return undefined;
    const days = Math.max(0, Math.round((Date.parse(today() + 'T00:00:00Z') - Date.parse((l.createdAt || today()) + 'T00:00:00Z')) / 86400000));
    return { destination: l.destination, stage: l.stage, daysOld: days, followUps: outboundCount(l), interest: l.interestLevel, source: l.source };
  }
  async function ask(text: string, lead = leadId) {
    const question = text.trim(); if (!question || busy) return;
    const history = msgs.map(m => ({ role: m.role, text: m.text || (m.guide ? m.guide.map(g => `${g.title}: ${(g.steps || []).join(' ')}`).join('\n') : '') }));
    setMsgs(prev => [...prev, { role: 'user', text: question }]); setQ(''); setBusy(true);
    try {
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, history, context: lead ? contextOf(lead) : undefined }) });
      const j = await r.json();
      if (!r.ok) setMsgs(prev => [...prev, { role: 'assistant', text: j.error || 'Something went wrong — please try again.', source: 'guide' }]);
      else setMsgs(prev => [...prev, { role: 'assistant', text: j.source === 'ai' ? j.answer : undefined, guide: j.source === 'guide' ? j.guide || [] : undefined, source: j.source, note: j.note }]);
    } catch { setMsgs(prev => [...prev, { role: 'assistant', text: 'Could not reach the server — check your internet and try again.', source: 'guide' }]); }
    setBusy(false);
  }
  useEffect(() => {
    if (seed && seed.n !== seen.current) { seen.current = seed.n; if (seed.leadId) setLeadId(seed.leadId); ask(seed.text, seed.leadId || ''); }
  }, [seed]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={box} data-testid="coach-ask">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={h3}>Ask the coach</div>
        <span data-testid="coach-mode" style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: status?.ai ? '#E6F4EE' : '#FFF4DB', color: status?.ai ? GREEN : AMBER }}>
          {status === null ? '…' : status.ai ? `AI assistant on (${status.provider === 'openai' ? 'ChatGPT' : 'Claude'})` : 'Built-in guide'}
        </span>
      </div>
      <div style={{ ...muted, marginBottom: 10 }}>Stuck with a client? Type what is happening — you get the steps and a message you can send.{status && !status.ai && admin ? ' To answer any question with AI, add an ANTHROPIC_API_KEY or OPENAI_API_KEY in your hosting settings.' : ''}</div>
      {!msgs.length && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {QUICK_QUESTIONS.map(s => <button key={s} className="btn btn-sm" data-testid="coach-quick" onClick={() => ask(s)}>{s}</button>)}
        </div>)}
      <div ref={thread} style={{ maxHeight: 440, overflowY: 'auto', marginBottom: 10, position: 'relative' }} data-testid="coach-thread">
        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} data-testid="coach-user" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><div style={{ background: NAVY, color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', maxWidth: '82%', fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{m.text}</div></div>
        ) : (
          <div key={i} data-testid="coach-reply" data-source={m.source} style={{ marginBottom: 10 }}>
            <div style={{ background: '#F6F8FB', borderRadius: '12px 12px 12px 2px', padding: '10px 12px', fontSize: 13.5, lineHeight: 1.55, maxWidth: '92%' }}>
              {m.text && <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>}
              {m.guide && (m.guide.length ? m.guide.map((g, k) => (
                <div key={k} style={{ marginBottom: k < m.guide!.length - 1 ? 12 : 0 }}>
                  <div style={{ fontWeight: 700, color: NAVY }}>{g.title}</div>
                  <div>{g.body}</div>
                  {g.steps && <ol style={{ margin: '4px 0 4px 18px', padding: 0 }}>{g.steps.map((s, n) => <li key={n}>{s}</li>)}</ol>}
                  {g.say && <><div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', marginTop: 4 }}>{g.say}</div>
                    <button className="btn btn-sm btn-ghost" onClick={() => copy(g.say as string, 'Message copied')}>Copy message</button></>}
                </div>))
                : <div>I do not have a ready answer for that. Try asking about: the fee being too high, a client who will “think about it”, no reply, asking for the advance, a past refusal, documents, or a family file. Or tell your manager what you are stuck on.</div>)}
              {m.text && m.source === 'ai' && <button className="btn btn-sm btn-ghost" onClick={() => copy(m.text as string)}>Copy</button>}
            </div>
            {m.note && <div style={{ ...muted, color: AMBER, margin: '3px 0 0 6px' }}>{m.note}</div>}
          </div>
        ))}
        {busy && <div style={muted} data-testid="coach-busy">Thinking…</div>}
      </div>
      {!admin && mine.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label className="text-[11.5px]">About one of your leads (optional — only the country, stage and follow-up count are shared, never the name or number)</label>
          <select data-testid="coach-lead" value={leadId} onChange={e => setLeadId(e.target.value)}>
            <option value="">— General question —</option>
            {mine.slice(0, 80).map(l => <option key={l.id} value={l.id}>{l.name} — {l.destination} ({l.stage})</option>)}
          </select>
        </div>)}
      <form onSubmit={e => { e.preventDefault(); ask(q); }} style={{ display: 'flex', gap: 8 }}>
        <input data-testid="coach-input" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. The client says another agent is cheaper — what do I say?" maxLength={1200} />
        <button className="btn btn-primary" data-testid="coach-send" type="submit" disabled={busy || !q.trim()}>Ask</button>
      </form>
    </div>
  );
}
