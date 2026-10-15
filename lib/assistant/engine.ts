import type { Lead, Case, Appointment, TeamMember, Complaint, EmployeeRequest, GroupTour, FollowUpTemplate, RateCardEntry, StaffTarget } from '../types';
import { money, fmtDate } from '../constants';
import { tokens, normalize, Index } from './text';
import { ENTRIES, ENTRY_BY_ID, STARTERS_HEAD, STARTERS_STAFF, type Entry } from './knowledge';
import { COUNTRIES, countryByWord, docsFor, type Country } from './countries';
import { coachQueue, nextAction, scriptFor, buildPost, bracket, fill, outboundCount, tipOfDay, postOfTheDay, CADENCE, type PostKind, type ScriptKind } from '../coach';
import { moneyHome, type MoneyInput } from '../money';
import { caseDue } from '../paymentPlan';
import { caseCharge, casePaid, casesClosedBy, collectedFor, closerOf, monthLabel, shiftMonth } from '../finance';
import { deskOf, specialtyLabel } from '../specialty';

// ---------------------------------------------------------------------------
// The assistant's brain. No AI service, no key, no internet: it reads the question
// (English or Roman Urdu), works out what is being asked, and answers from
//   1. the portal's own live data  (who to call today, who owes money, this month…)
//   2. the company's guide         (lib/coach.ts, lib/assistant/knowledge.ts, countries.ts)
// and it says so plainly when it does not know. It never invents a fee, a waiting
// time or an embassy rule.
//
// What it is NOT: a general chatbot. It cannot hold an open conversation about
// anything in the world; it answers about this business, visas and this portal.
// ---------------------------------------------------------------------------

export interface AssistantData extends MoneyInput {
  todayIso: string; nowMs: number;
  role: 'head' | 'staff'; staffId: string;
  complaints: Complaint[]; requests: EmployeeRequest[]; groupTours: GroupTour[];
  followUpTemplates: FollowUpTemplate[]; rateCard: RateCardEntry[]; staffTargets: StaffTarget[];
}

export type Tone = 'bad' | 'warn' | 'good';
export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'steps'; items: string[] }
  | { t: 'bullets'; items: string[] }
  | { t: 'say'; text: string; label?: string }
  | { t: 'rows'; items: { label: string; value: string; sub?: string; tone?: Tone; go?: string }[] }
  | { t: 'note'; text: string; tone?: 'warn' | 'info' };
export interface Go { tab: string; label: string }

export interface Memory { pref: 'auto' | 'en' | 'ur'; country?: string; leadId?: string; caseId?: string; lastQ?: string; turns: number }
export const NEW_MEMORY: Memory = { pref: 'auto', turns: 0 };

export interface Reply { blocks: Block[]; follow: string[]; go: Go[]; memory: Memory; intent: string; plain: string }

// ---------- reading the question ----------
const memoT = new Map<string, string>();
function T(w: string): string { let v = memoT.get(w); if (v === undefined) { v = tokens(w)[0] || ''; memoT.set(w, v); } return v; }

interface Ents { country?: Country; lead?: Lead; kase?: Case; person?: TeamMember; ambiguous?: string[]; names: string[] }
interface Ctx {
  d: AssistantData; raw: string; low: string; toks: string[]; set: Set<string>;
  ur: boolean; short: boolean; detail: boolean; variant: number; mem: Memory; ent: Ents; clean: string;
  me: TeamMember | null; head: boolean; month: string;
}
const has = (c: Ctx, ...ws: string[]) => ws.some(w => { const t = T(w); return !!t && c.set.has(t); });
const L = (c: Ctx, en: string, ur: string) => (c.ur ? ur : en);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

const URDU_STRONG = /\b(kya|kaise|kese|kaisay|nahi|nahin|mujhe|mujhay|mere|meri|mera|aaj|kal|kitna|kitne|kitni|batao|bataiye|bata|dikhao|karun|karna|karo|chahiye|kab|kaun|kon|baqi|paisay|paise|hamara|hamari|likho|banao|bhejo|samajh|zyada|abhi|kis|kisne|wala|walay|hota|hoti|mein|jawab|shukriya|karen|kare)\b/g;
const URDU_WEAK = /\b(hai|hain|ka|ki|ke|ko|se|par|aur|ho|hun|tha|thi|us|is|ye|yeh|woh|wo|bhi|karta|karti|karte|deta|deti|dete|raha|rahi|rahe|lena|dena|uthata|uthati|hota|hoti)\b/g;
function looksUrdu(raw: string): boolean {
  const s = raw.toLowerCase();
  const strong = (s.match(URDU_STRONG) || []).length, weak = (s.match(URDU_WEAK) || []).length;
  return strong >= 1 && strong + weak >= 2 || strong >= 2 || (/\burdu\b/.test(s) && /\b(in|mein|me)\b/.test(s));
}

function firstName(s: string) { return (s || '').trim().split(/\s+/)[0] || ''; }
const nameKey = (s: string) => ` ${(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;

function detect(c: Omit<Ctx, 'ent' | 'clean'>): Ents {
  const { d, low, toks } = c;
  const ent: Ents = { names: [] };
  for (const t of toks) { const k = countryByWord(t); if (k) { ent.country = k; break; } }

  const q = nameKey(low);
  const mine = (l: Lead) => c.head || l.assignedTo === d.staffId;
  const myCase = (k: Case) => c.head || k.consultant === d.staffId || closerOf(k) === d.staffId;
  const gg = low.match(/\bgg\s*-?\s*(\d{1,4})\b/);
  if (gg) {
    const code = 'GG' + String(Number(gg[1])).padStart(2, '0');
    const k = d.cases.find(x => (x.queryNo || '').toUpperCase() === code && myCase(x));
    if (k) ent.kase = k;
  }
  const phone = (low.match(/(?:\+?92|0)?\s?3\d{2}[\s-]?\d{7}/) || [])[0];
  const last7 = phone ? phone.replace(/\D/g, '').slice(-7) : '';
  if (last7.length === 7) {
    const k = d.cases.find(x => (x.phone || '').replace(/\D/g, '').endsWith(last7) && myCase(x));
    if (k && !ent.kase) { ent.kase = k; ent.names.push(k.name, firstName(k.name)); }
    const l = d.leads.find(x => (x.phone || '').replace(/\D/g, '').endsWith(last7) && mine(x));
    if (l) { ent.lead = l; ent.names.push(l.name, firstName(l.name)); }
  }
  if (!ent.lead) {
    const pool = d.leads.filter(mine);
    let hits = pool.filter(l => nameKey(l.name).trim().length >= 3 && q.includes(nameKey(l.name)));
    if (!hits.length) hits = pool.filter(l => { const f = nameKey(l.name).trim().split(' ')[0]; return f.length >= 4 && q.includes(` ${f} `); });
    if (hits.length) {
      hits.sort((a, b) => (b.receivedAt || b.createdAt || '').localeCompare(a.receivedAt || a.createdAt || ''));
      ent.lead = hits[0]; ent.names.push(hits[0].name, firstName(hits[0].name));
      if (hits.length > 1) ent.ambiguous = hits.slice(1, 5).map(h => h.name);
    }
  }
  if (!ent.kase) {
    const pool = d.cases.filter(myCase);
    let hits = pool.filter(k => nameKey(k.name).trim().length >= 3 && q.includes(nameKey(k.name)));
    if (!hits.length) hits = pool.filter(k => { const f = nameKey(k.name).trim().split(' ')[0]; return f.length >= 4 && q.includes(` ${f} `); });
    if (hits.length) { hits.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); ent.kase = hits[0]; ent.names.push(hits[0].name, firstName(hits[0].name)); }
  }
  if (c.head) {
    const people = d.team.filter(t => nameKey(t.name).trim().length >= 3);
    const hit = people.find(t => q.includes(nameKey(t.name))) || people.find(t => { const f = nameKey(t.name).trim().split(' ')[0]; return f.length >= 4 && q.includes(` ${f} `); });
    if (hit && !ent.lead && !ent.kase) { ent.person = hit; ent.names.push(hit.name, firstName(hit.name)); }
  }
  return ent;
}

// ---------- building a reply ----------
function textOf(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.t) {
      case 'p': case 'h': return b.text;
      case 'steps': return b.items.map((x, i) => `${i + 1}. ${x}`).join('\n');
      case 'bullets': return b.items.map(x => `• ${x}`).join('\n');
      case 'say': return b.text;
      case 'rows': return b.items.map(r => `${r.label}: ${r.value}${r.sub ? ` — ${r.sub}` : ''}`).join('\n');
      case 'note': return b.text;
    }
  }).join('\n\n');
}

function done(c: Ctx, intent: string, blocks: Block[], o: { follow?: string[]; go?: Go[]; mem?: Partial<Memory> } = {}): Reply {
  let out = blocks;
  if (c.short) {
    const first = blocks.find(b => b.t === 'p'); const say = blocks.find(b => b.t === 'say');
    const rows = blocks.find(b => b.t === 'rows');
    out = [first, rows && rows.t === 'rows' ? { ...rows, items: rows.items.slice(0, 3) } : undefined, say].filter(Boolean) as Block[];
    if (!out.length) out = blocks.slice(0, 1);
  }
  const memory: Memory = { ...c.mem, ...(o.mem || {}) };
  if (c.ent.country) memory.country = c.ent.country.id;
  if (c.ent.lead) memory.leadId = c.ent.lead.id;
  if (c.ent.kase) memory.caseId = c.ent.kase.id;
  memory.lastQ = c.raw;
  return { blocks: out, follow: (o.follow || []).slice(0, 4), go: (o.go || []).slice(0, 3), memory, intent, plain: textOf(out) };
}

// the answer for a message that has blanks: fill what we know, show the rest as [hints]
function personalise(c: Ctx, text: string, lead?: Lead): string {
  const agent = c.me?.name || '';
  if (lead) return bracket(fill(text, { name: (lead.name || '').split(' ')[0], destination: lead.destination, agent: agent || 'your consultant' }));
  return bracket(agent ? text.replace(/\{agent\}/g, agent) : text);
}

// ---------- the search over what we know ----------
const INDEX = new Index(ENTRIES.map(e => ({ id: e.id, text: `${e.title} ${e.title} ${e.q} ${e.answer}` })));

function entryReply(c: Ctx, e: Entry, intent = 'knowledge', extraFollow: string[] = []): Reply {
  const lead = c.ent.lead || (c.mem.leadId ? c.d.leads.find(l => l.id === c.mem.leadId && (c.head || l.assignedTo === c.d.staffId)) : undefined);
  const useLead = c.ent.lead || (/\{name\}/.test(e.say || '') && lead && !c.ent.country ? lead : undefined);
  const blocks: Block[] = [];
  blocks.push({ t: 'h', text: e.title });
  if (c.ur && e.ur) {
    blocks.push({ t: 'p', text: e.ur });
    if (c.detail && e.steps) blocks.push({ t: 'steps', items: e.steps });
  } else {
    if (c.ur && !e.ur) blocks.push({ t: 'note', text: 'Roman Urdu for this answer is not written yet — here it is in English.', tone: 'info' });
    blocks.push({ t: 'p', text: e.answer });
    if (e.steps) blocks.push({ t: 'steps', items: e.steps });
  }
  const say = c.ur ? (e.sayUr || e.say) : e.say;
  if (say) blocks.push({ t: 'say', text: personalise(c, say, useLead), label: useLead ? `Message for ${useLead.name.split(' ')[0]}` : 'A message you can send' });
  if (e.kind === 'sales') blocks.push({ t: 'note', text: 'Never promise approval — the embassy decides. Fees and discounts are agreed with your manager.', tone: 'info' });
  if (e.id === 'g-documents') {
    const k = c.ent.country || COUNTRIES.find(x => x.id === (c.mem.country || ''));
    const id = k?.id || 'UK';
    blocks.splice(2, 0, { t: 'h', text: `Documents usually needed for ${k?.name || 'the UK'}` }, { t: 'bullets', items: docsFor(id) });
  }
  const head = e.headOnly && !c.head;
  if (head) blocks.unshift({ t: 'note', text: 'This part of the portal is for the Head Manager, so you may not see it in your menu.', tone: 'info' });
  return done(c, intent, blocks, { follow: [...(e.follow || []), ...extraFollow], go: e.go });
}

function asked(c: Ctx, min = 2.4): { e: Entry; score: number }[] {
  const hits = INDEX.search(c.clean, 4).filter(h => (h.score >= min && h.cover >= 0.55) || h.score >= 10);
  return hits.map(h => ({ e: ENTRY_BY_ID[h.id], score: h.score }));
}

// ---------- country questions ----------
const GENERIC_FOLLOW = (k: Country) => [`Documents for ${k.id === 'Schengen' ? 'Schengen' : k.id}`, `Why do ${k.id} visas get refused?`, `How do I pitch ${k.id} to a client?`];

function rateRows(c: Ctx, k: Country): Block[] {
  const rates = c.d.rateCard.filter(r => r.destination === k.id);
  if (!rates.length) return [];
  return [{ t: 'h', text: `Our own rates for ${k.id} (from Pricing by Country)` }, { t: 'rows', items: rates.map(r => ({ label: r.visaType, value: `Consultation ${money(r.consultFee)}`, sub: `Visa service ${money(r.visaFee)} · Appointment ${money(r.apptFee)}` })) }];
}

function countryReply(c: Ctx, k: Country): Reply {
  const mk = (title: string, body: Block[], follow?: string[], go?: Go[]) => done(c, 'country', [{ t: 'h', text: title }, ...body, { t: 'note', text: `Rules, fees and waiting times change — confirm the current ones on ${k.confirm} before you tell a client.`, tone: 'warn' }], { follow: follow || GENERIC_FOLLOW(k), go });
  const visaWord = has(c, 'student') ? 'student' : has(c, 'work') ? 'work' : has(c, 'family', 'spouse', 'parents') ? 'family' : '';

  if (has(c, 'document', 'checklist', 'bankstatement', 'coverletter') && !has(c, 'refusal')) {
    const biz = has(c, 'business');
    return mk(`${k.name} — documents${biz ? ' (business)' : ''}`, [{ t: 'bullets', items: docsFor(k.id, biz ? 'Business' : 'Tourist') }, { t: 'p', text: 'This is the portal’s standard checklist. A particular case may need more — check each file against the cover letter.' }], [`Why do ${k.id} visas get refused?`, 'Write a post with this checklist', `What is the process for ${k.id}?`], [{ tab: 'cases', label: 'Open Cases' }]);
  }
  if (has(c, 'refusal')) return mk(`Why ${k.name} visas get refused`, [{ t: 'bullets', items: k.refusals }, { t: 'h', text: 'How to avoid it' }, { t: 'bullets', items: k.tips.slice(0, 4) }]);
  if (has(c, 'fee') && !has(c, 'expensive') && !c.ent.kase) {
    return mk(`${k.name} — fees`, [{ t: 'p', text: 'I do not quote embassy fees from memory because they change. Our own service rates are set in the portal, and the embassy fee must be checked on the official site on the day.' }, ...rateRows(c, k)], undefined, [{ tab: 'pricing', label: 'Pricing by Country' }]);
  }
  if (has(c, 'howlong', 'processing') || (has(c, 'time') && has(c, 'visa'))) return mk(`${k.name} — how long does it take?`, [{ t: 'p', text: k.timing }, { t: 'p', text: k.whenToApply }]);
  if (has(c, 'fund', 'savings') || (has(c, 'bankstatement') && !has(c, 'document'))) return mk(`${k.name} — funds`, [{ t: 'p', text: k.funds }, { t: 'p', text: 'Never suggest showing money that is not the applicant’s, or edited statements.' }]);
  if (visaWord === 'student' && k.student) return mk(`${k.name} — student visa`, [{ t: 'bullets', items: k.student }]);
  if (visaWord === 'work' && k.work) return mk(`${k.name} — work visa`, [{ t: 'bullets', items: k.work }, { t: 'note', text: 'Work visas depend on employers and licences — involve your manager early.', tone: 'info' }]);
  if (visaWord === 'family' && k.family) return mk(`${k.name} — family`, [{ t: 'bullets', items: k.family }]);
  if (has(c, 'sell', 'pitch', 'convince', 'client')) return mk(`How to pitch ${k.name}`, [{ t: 'p', text: k.sell }, { t: 'h', text: 'Good things to say' }, { t: 'bullets', items: k.tips.slice(0, 3) }, { t: 'say', text: `Hello [client name], for a ${k.id} visa the details decide the result. ${k.sell}`, label: 'A message you can adapt' }]);
  if (has(c, 'tip', 'advice', 'mistake')) return mk(`${k.name} — tips`, [{ t: 'bullets', items: k.tips }]);
  if (has(c, 'process', 'step', 'procedure', 'apply', 'how')) return mk(`${k.name} — the process`, [{ t: 'steps', items: k.process }, { t: 'p', text: k.whenToApply }]);
  if (has(c, 'visa') && has(c, 'type', 'kind', 'categorie', 'option', 'which')) return mk(`${k.name} — visa types`, [{ t: 'rows', items: k.visas.map(v => ({ label: v.name, value: v.note })) }]);
  // default: the overview
  const desk = deskOf(k.id);
  const people = desk ? c.d.team.filter(t => (t.specialties || []).includes(desk) && (!t.employmentStatus || t.employmentStatus === 'Active')).map(t => t.name) : [];
  return mk(`${k.name} — overview`, [
    { t: 'p', text: k.overview },
    { t: 'rows', items: k.visas.slice(0, 4).map(v => ({ label: v.name, value: v.note })) },
    ...(people.length ? [{ t: 'p', text: `${k.desk}: ${people.join(', ')}.` } as Block] : []),
  ]);
}

// ---------- data answers ----------
const nameOf = (c: Ctx, id: string) => c.d.team.find(t => t.id === id)?.name || 'Nobody';
const myCases = (c: Ctx) => c.d.cases.filter(k => c.head || k.consultant === c.d.staffId || closerOf(k) === c.d.staffId);
const myLeads = (c: Ctx) => c.d.leads.filter(l => c.head || l.assignedTo === c.d.staffId);
const openLead = (l: Lead) => l.stage !== 'Converted' && l.stage !== 'Lost';
const daysAgo = (c: Ctx, iso?: string) => iso ? Math.max(0, Math.round((Date.parse(c.d.todayIso + 'T00:00:00Z') - Date.parse(iso.slice(0, 10) + 'T00:00:00Z')) / 86400000)) : 0;
const ago = (n: number) => n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;

function headOnly(c: Ctx, what: string): Reply {
  const mineNum = c.me ? collectedFor(c.d.cases, c.d.transactions, c.me.id, c.month) : 0;
  return done(c, 'private', [
    { t: 'p', text: L(c, `${what} is shown to the Head Manager only, so I cannot share it from your login.`, `${what} sirf Head Manager ko dikhaya jata hai, is liye aap ke login se main yeh nahi bata sakta.`) },
    { t: 'p', text: L(c, `What I can show you is your own work: your leads, your cases and your commission${mineNum ? ` (${money(mineNum)} collected on your files this month)` : ''}.`, 'Main aap ka apna kaam dikha sakta hoon: aap ke leads, cases aur commission.') },
  ], { follow: ['What should I do today?', 'How much commission have I earned this month?', 'Which of my clients still owe money?'] });
}

function dayPlan(c: Ctx): Reply {
  const d = c.d;
  if (!c.head) {
    const q = coachQueue(d.leads, d.staffId, d.todayIso, d.nowMs, 6);
    const appts = d.appointments.filter(a => a.status === 'Scheduled' && a.date === d.todayIso && (a.consultant === d.staffId));
    const blocks: Block[] = [];
    if (!q.total) blocks.push({ t: 'p', text: L(c, 'Nothing urgent right now — every open lead has a follow-up date in the future. Use the time to post today’s post, ask a happy client for a referral, or revive an old lead.', 'Abhi koi urgent kaam nahi — har open lead ki follow-up date aage hai. Waqt ka faida uthayein: aaj ki post lagayein, kisi khush client se referral maangein, ya purane lead ko dobara jagayein.') });
    else {
      blocks.push({ t: 'p', text: L(c, `You have ${plural(q.total, 'lead')} to act on: ${q.now} do-now, ${q.today} today, ${q.soon} soon.${q.total > q.items.length ? ` Here are the top ${q.items.length}.` : ''}`, `Aap ke ${q.total} leads par kaam baqi hai: ${q.now} abhi, ${q.today} aaj, ${q.soon} jald. ${q.total > q.items.length ? `Sab se ahem ${q.items.length} yeh hain.` : ''}`) });
      blocks.push({ t: 'rows', items: q.items.map(a => ({ label: `${a.name} · ${a.destination}`, value: a.title, sub: a.why, tone: a.urgency === 'now' ? 'bad' : a.urgency === 'today' ? 'warn' : undefined, go: 'coach' })) });
      const first = q.items[0]; const lead = d.leads.find(l => l.id === first.leadId);
      if (lead) blocks.push({ t: 'say', label: `Message for ${firstName(lead.name)}`, text: scriptFor(lead, first.kind as ScriptKind, c.me?.name || 'your consultant', d.followUpTemplates) });
    }
    if (appts.length) blocks.push({ t: 'bullets', items: appts.map(a => `${a.time || 'Today'} — ${a.clientName} (${a.type})`) });
    const tip = tipOfDay(d.todayIso);
    blocks.push({ t: 'note', text: `Tip of the day — ${tip.title}: ${tip.body}`, tone: 'info' });
    return done(c, 'dayplan', blocks, { follow: q.items[0] ? [`Tell me about ${q.items[0].name}`, 'The client does not reply', 'Write a post for today'] : ['Write a post for today', 'Reviving old leads'], go: [{ tab: 'coach', label: 'Open My next actions' }] });
  }
  // Head Manager: what needs attention across the firm
  const mh = moneyHome(c.month, d, d.todayIso);
  const untouched = d.leads.filter(l => l.stage === 'New' && outboundCount(l) === 0);
  const unassigned = d.leads.filter(l => openLead(l) && !l.assignedTo);
  const overdueF = d.leads.filter(l => openLead(l) && l.nextFollowUp && l.nextFollowUp < d.todayIso).length;
  const appts = d.appointments.filter(a => a.status === 'Scheduled' && a.date === d.todayIso).length;
  const reqs = d.requests.filter(r => r.status === 'Pending').length;
  const comps = d.complaints.filter(x => x.status !== 'Resolved').length;
  const rows: { label: string; value: string; sub?: string; tone?: Tone; go?: string }[] = [];
  mh.attention.filter(a => a.tone !== 'good').forEach(a => rows.push({ label: a.goLabel, value: a.text, tone: a.tone === 'bad' ? 'bad' : 'warn', go: a.go }));
  if (untouched.length) rows.push({ label: 'New leads nobody has contacted', value: String(untouched.length), tone: untouched.length > 3 ? 'bad' : 'warn', go: 'leads' });
  if (unassigned.length) rows.push({ label: 'Leads with no agent', value: String(unassigned.length), tone: 'warn', go: 'leads' });
  if (overdueF) rows.push({ label: 'Follow-ups overdue', value: String(overdueF), tone: 'warn', go: 'perfwatch' });
  if (appts) rows.push({ label: 'Appointments today', value: String(appts), go: 'appointments' });
  if (reqs) rows.push({ label: 'Team requests waiting', value: String(reqs), tone: 'warn', go: 'hr' });
  if (comps) rows.push({ label: 'Open complaints', value: String(comps), tone: 'warn', go: 'complaints' });
  const blocks: Block[] = [rows.length
    ? { t: 'p', text: L(c, `${plural(rows.length, 'thing')} need${rows.length === 1 ? 's' : ''} you today:`, `Aaj ${rows.length} cheezein aap ki tawajjoh chahti hain:`) }
    : { t: 'p', text: L(c, 'Everything is in order today — nothing is late and nothing is waiting on you.', 'Aaj sab theek hai — kuch late nahi aur aap ka intezar nahi kar raha.') }];
  if (rows.length) blocks.push({ t: 'rows', items: rows.slice(0, 8) });
  return done(c, 'attention', blocks, { follow: ['Who owes us money?', 'How much have we received this month?', 'Who is my top agent this month?'], go: [{ tab: 'money', label: 'Finance Overview' }] });
}

function newLeads(c: Ctx): Reply {
  const pool = myLeads(c).filter(l => l.stage === 'New').sort((a, b) => (b.receivedAt || b.createdAt || '').localeCompare(a.receivedAt || a.createdAt || ''));
  const untouched = pool.filter(l => outboundCount(l) === 0);
  const todayN = pool.filter(l => (l.createdAt || '') === c.d.todayIso).length;
  if (!pool.length) return done(c, 'newleads', [{ t: 'p', text: L(c, 'There are no new leads waiting. Every lead has been contacted.', 'Koi naya lead intezar mein nahi — sab se rabta ho chuka hai.') }], { follow: ['What should I do today?', 'Reviving old leads'] });
  return done(c, 'newleads', [
    { t: 'p', text: L(c, `${plural(pool.length, 'new lead')} (${untouched.length} not contacted yet${todayN ? `, ${todayN} came in today` : ''}).`, `${pool.length} naye leads hain (${untouched.length} se abhi rabta nahi hua${todayN ? `, ${todayN} aaj aaye` : ''}).`) },
    { t: 'rows', items: pool.slice(0, 6).map(l => ({ label: `${l.name} · ${l.destination}`, value: outboundCount(l) ? 'Contacted' : 'Not contacted', sub: `${ago(daysAgo(c, l.createdAt))}${c.head ? ` · ${l.assignedTo ? nameOf(c, l.assignedTo) : 'no agent'}` : ''}`, tone: outboundCount(l) ? undefined : 'warn', go: 'leads' })) },
    { t: 'note', text: 'The first agent to reply usually wins the client — call first, then WhatsApp.', tone: 'info' },
  ], { follow: ['Write a first message for a new lead', 'How do I qualify a lead?'], go: [{ tab: 'leads', label: 'Open Leads' }] });
}

function leadReply(c: Ctx, l: Lead): Reply {
  const now = c.d.nowMs; const act = nextAction(l, c.d.todayIso, now);
  const blocks: Block[] = [];
  if (c.ent.ambiguous?.length) blocks.push({ t: 'note', text: `More than one lead matches. Showing the newest — others: ${c.ent.ambiguous.join(', ')}.`, tone: 'info' });
  blocks.push({ t: 'h', text: `${l.name} · ${l.destination}${l.isVip ? ' · VIP' : ''}` });
  blocks.push({ t: 'rows', items: [
    { label: 'Stage', value: l.stage },
    { label: 'Agent', value: l.assignedTo ? nameOf(c, l.assignedTo) : 'Nobody yet', tone: l.assignedTo ? undefined : 'warn' },
    { label: 'Came in', value: `${fmtDate(l.createdAt)} (${ago(daysAgo(c, l.createdAt))})${l.source ? ` · ${l.source}` : ''}` },
    { label: 'Last contacted', value: l.lastContacted ? `${fmtDate(l.lastContacted)} (${ago(daysAgo(c, l.lastContacted))})` : 'Never' },
    { label: 'Next follow-up', value: l.nextFollowUp ? fmtDate(l.nextFollowUp) : 'Not set', tone: !l.nextFollowUp && openLead(l) ? 'warn' : l.nextFollowUp && l.nextFollowUp < c.d.todayIso && openLead(l) ? 'bad' : undefined },
    { label: 'Messages sent', value: String(outboundCount(l)) },
  ] });
  if (l.notes) blocks.push({ t: 'p', text: `Notes: ${l.notes.length > 220 ? l.notes.slice(0, 220) + '…' : l.notes}` });
  if (act) {
    blocks.push({ t: 'h', text: `What to do next: ${act.title}` }, { t: 'p', text: act.why }, { t: 'steps', items: act.steps });
    blocks.push({ t: 'say', label: `Message for ${firstName(l.name)}`, text: scriptFor(l, act.kind as ScriptKind, c.me?.name || 'your consultant', c.d.followUpTemplates) });
  } else if (openLead(l)) blocks.push({ t: 'p', text: 'Nothing is due right now. The next follow-up date is in the future.' });
  return done(c, 'lead', blocks, { follow: [`Write a follow-up for ${firstName(l.name)}`, 'The client does not reply', 'How do I close this sale?'], go: [{ tab: 'leads', label: 'Open Leads' }], mem: { leadId: l.id } });
}

function caseReply(c: Ctx, k: Case): Reply {
  const due = caseDue(k, c.d.appointments, c.d.todayIso);
  const charge = caseCharge(k), paid = casePaid(k);
  const rows: { label: string; value: string; sub?: string; tone?: Tone }[] = [
    { label: 'Query number', value: k.queryNo || '—' },
    { label: 'Country / visa', value: `${k.destination} · ${k.visaType}` },
    { label: 'Stage', value: `${k.caseStage} (${k.status})` },
    { label: 'Fee agreed', value: money(charge) },
    { label: 'Paid so far', value: money(paid) },
    { label: 'Still owed', value: money(Math.max(0, charge - paid)), tone: due.overdue > 0 ? 'bad' : charge - paid > 0 ? 'warn' : 'good', sub: due.overdue > 0 ? `${money(due.overdue)} of it is late` : due.next ? `${due.next.label}${due.next.due ? ` due ${fmtDate(due.next.due)}` : ' — no date promised'}` : undefined },
    { label: 'Consultant', value: nameOf(c, k.consultant) },
  ];
  if (k.referredByQueryNo) rows.push({ label: 'Referred by', value: k.referredByQueryNo });
  const blocks: Block[] = [{ t: 'h', text: `${k.name} · ${k.queryNo || k.referenceCode}` }, { t: 'rows', items: rows }];
  if (due.outstanding > 0 && due.overdue > 0) blocks.push({ t: 'note', text: 'This client is late. A friendly reminder usually works — ask for the payment date and write it in the case.', tone: 'warn' });
  return done(c, 'case', blocks, { follow: ['How do I ask for the balance?', 'How do I record a payment?'], go: [{ tab: 'cases', label: 'Open Cases' }], mem: { caseId: k.id } });
}

function owed(c: Ctx): Reply {
  if (c.head) {
    const mh = moneyHome(c.month, c.d, c.d.todayIso);
    const blocks: Block[] = [
      { t: 'p', text: L(c, `Clients still owe ${money(mh.stillOwed)} on ${plural(mh.owedFiles, 'file')}.${mh.lateNow ? ` ${money(mh.lateNow)} of it is late.` : ''}`, `Clients ne abhi ${money(mh.stillOwed)} dene hain (${mh.owedFiles} files).${mh.lateNow ? ` Is mein se ${money(mh.lateNow)} late hai.` : ''}`) },
    ];
    if (mh.owingTop.length) blocks.push({ t: 'rows', items: mh.owingTop.map(r => ({ label: `${r.name} · ${r.destination}`, value: money(r.amount), sub: r.days > 0 ? `${r.days} days since the file opened` : undefined, tone: r.days > 30 ? 'bad' : 'warn', go: 'billing' })) });
    blocks.push({ t: 'note', text: 'This money is not counted in “Received” until the client pays.', tone: 'info' });
    return done(c, 'owed', blocks, { follow: ['How much have we received this month?', 'How do I ask for the balance?'], go: [{ tab: 'billing', label: 'Who Owes Us' }] });
  }
  const rows = myCases(c).map(k => ({ k, due: caseDue(k, c.d.appointments, c.d.todayIso) })).filter(x => x.due.outstanding > 0)
    .sort((a, b) => b.due.overdue - a.due.overdue || b.due.outstanding - a.due.outstanding);
  if (!rows.length) return done(c, 'owed', [{ t: 'p', text: L(c, 'None of your clients owes anything right now.', 'Aap ke kisi client ne abhi kuch ada nahi karna.') }], { follow: ['What should I do today?'] });
  return done(c, 'owed', [
    { t: 'p', text: L(c, `${plural(rows.length, 'client')} of yours still owe ${money(sum(rows.map(x => x.due.outstanding)))} in total.`, `Aap ke ${rows.length} clients ne abhi ${money(sum(rows.map(x => x.due.outstanding)))} dene hain.`) },
    { t: 'rows', items: rows.slice(0, 6).map(x => ({ label: `${x.k.name} · ${x.k.queryNo || ''}`, value: money(x.due.outstanding), sub: x.due.overdue > 0 ? `${money(x.due.overdue)} late` : x.due.next?.due ? `due ${fmtDate(x.due.next.due)}` : 'no date promised', tone: x.due.overdue > 0 ? 'bad' : 'warn' })) },
  ], { follow: ['How do I ask for the balance?'], go: [{ tab: 'cases', label: 'Open Cases' }] });
}

function moneyNow(c: Ctx): Reply {
  if (!c.head) return headOnly(c, 'The firm’s money');
  const prev = has(c, 'last') && has(c, 'month');
  const month = prev ? shiftMonth(c.d.todayIso.slice(0, 7), -1) : c.month;
  const mh = moneyHome(month, c.d, c.d.todayIso);
  const lead = has(c, 'spent') ? L(c, `In ${mh.label} you spent ${money(mh.spent)}.`, `${mh.label} mein aap ne ${money(mh.spent)} kharch kiye.`)
    : has(c, 'profit') ? (mh.kept >= 0 ? L(c, `In ${mh.label} the business kept ${money(mh.kept)}.`, `${mh.label} mein business ne ${money(mh.kept)} bachaye.`) : L(c, `In ${mh.label} more went out than came in: ${money(-mh.kept)} short.`, `${mh.label} mein aamdan se zyada kharch hua: ${money(-mh.kept)} ki kami.`))
    : L(c, `In ${mh.label} you received ${money(mh.received)}${mh.running ? ' so far' : ''}.`, `${mh.label} mein ${money(mh.received)} wasool hue${mh.running ? ' (ab tak)' : ''}.`);
  return done(c, 'money', [
    { t: 'p', text: lead },
    { t: 'rows', items: [
      { label: 'Received', value: money(mh.received), sub: 'cash that actually arrived', tone: 'good', go: 'accounts' },
      { label: 'Spent', value: money(mh.spent), sub: mh.spendGroups[0] ? `biggest: ${mh.spendGroups[0].label} ${money(mh.spendGroups[0].amount)}` : 'cash that actually left', go: 'payouts' },
      { label: 'What we kept', value: `${mh.kept < 0 ? '− ' : ''}${money(Math.abs(mh.kept))}`, sub: 'Received − Spent', tone: mh.kept >= 0 ? 'good' : 'bad', go: 'profit' },
      { label: 'Clients still owe', value: money(mh.stillOwed), sub: mh.lateNow ? `${money(mh.lateNow)} late` : 'not counted above until paid', tone: mh.lateNow ? 'bad' : 'warn', go: 'billing' },
    ] },
    { t: 'p', text: mh.story.slice(1, 3).join(' ') },
  ], { follow: ['Finance in one minute', 'Who owes us money?', 'What do we have to pay out?'], go: [{ tab: 'money', label: 'Finance Overview' }] });
}

function payoutsNow(c: Ctx): Reply {
  if (!c.head) return headOnly(c, 'What the firm has to pay out');
  const mh = moneyHome(c.month, c.d, c.d.todayIso);
  const out = mh.soon.filter(s => s.kind === 'out');
  return done(c, 'payouts', [
    { t: 'p', text: L(c, `Still to pay out: ${money(mh.payoutsTotal)} in the coming months — ${money(mh.payoutsThisMonth)} this month${mh.payoutsOverdue ? `, and ${money(mh.payoutsOverdue)} is already past its date` : ''}.`, `Abhi ada karna baqi: ${money(mh.payoutsTotal)} — is mahine ${money(mh.payoutsThisMonth)}${mh.payoutsOverdue ? `, aur ${money(mh.payoutsOverdue)} ki tareekh guzar chuki hai` : ''}.`) },
    ...(out.length ? [{ t: 'rows', items: out.slice(0, 6).map(s => ({ label: `${s.who}`, value: money(s.amount), sub: `${s.what}${s.date ? ` · ${fmtDate(s.date)}` : ''}`, tone: s.date && s.date < c.d.todayIso ? 'bad' : undefined, go: 'payouts' })) } as Block] : []),
    ...(mh.unpaidPayroll ? [{ t: 'note', text: `Payroll of ${money(mh.unpaidPayroll)} is approved but not paid yet.`, tone: 'warn' } as Block] : []),
  ], { follow: ['How do I run payroll?', 'Who owes us money?'], go: [{ tab: 'payouts', label: 'Money Going Out' }] });
}

function bankNow(c: Ctx): Reply {
  if (!c.head) return headOnly(c, 'Bank balances');
  const accs = c.d.bankAccounts;
  if (!accs.length) return done(c, 'bank', [{ t: 'p', text: 'No bank accounts have been added yet. Add them under Finance → Books & Banks.' }], { go: [{ tab: 'accounts', label: 'Books & Banks' }] });
  return done(c, 'bank', [
    { t: 'p', text: L(c, `Across ${plural(accs.length, 'account')} you hold ${money(sum(accs.map(a => a.balance)))}.`, `${accs.length} accounts mein kul ${money(sum(accs.map(a => a.balance)))} hain.`) },
    { t: 'rows', items: accs.map(a => ({ label: a.bankName, value: money(a.balance), sub: a.accountTitle })) },
  ], { go: [{ tab: 'accounts', label: 'Books & Banks' }] });
}

function appointmentsNow(c: Ctx): Reply {
  const today = c.d.todayIso;
  const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  const weekEnd = new Date(Date.parse(today + 'T00:00:00Z') + 7 * 86400000).toISOString().slice(0, 10);
  const mine = c.d.appointments.filter(a => a.status === 'Scheduled' && (c.head || a.consultant === c.d.staffId));
  const tom = has(c, 'tomorrow'); const wk = has(c, 'week', 'upcoming', 'next');
  const list = (tom ? mine.filter(a => a.date === tomorrow) : wk ? mine.filter(a => a.date >= today && a.date <= weekEnd) : mine.filter(a => a.date === today)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const when = tom ? 'tomorrow' : wk ? 'in the next 7 days' : 'today';
  if (!list.length) return done(c, 'appointments', [{ t: 'p', text: L(c, `No appointments ${when}.`, `${tom ? 'Kal' : wk ? 'Agle 7 din mein' : 'Aaj'} koi appointment nahi.`) }], { follow: ['How do I book an appointment?'], go: [{ tab: 'appointments', label: 'Open Appointments' }] });
  return done(c, 'appointments', [
    { t: 'p', text: L(c, `${plural(list.length, 'appointment')} ${when}.`, `${tom ? 'Kal' : wk ? 'Agle 7 din mein' : 'Aaj'} ${list.length} appointments hain.`) },
    { t: 'rows', items: list.slice(0, 8).map(a => ({ label: a.clientName, value: `${fmtDate(a.date)}${a.time ? ` · ${a.time}` : ''}`, sub: `${a.type}${a.portal ? ` · ${a.portal}` : ''}${c.head ? ` · ${nameOf(c, a.consultant)}` : ''}`, go: 'appointments' })) },
  ], { go: [{ tab: 'appointments', label: 'Open Appointments' }] });
}

function topAgent(c: Ctx): Reply {
  if (!c.head) return headOnly(c, 'The team ranking');
  const staff = c.d.team.filter(t => (!t.employmentStatus || t.employmentStatus === 'Active') && t.department === 'Sales');
  const rows = staff.map(t => ({ t, closed: casesClosedBy(c.d.cases, t.id, c.month).length, collected: collectedFor(c.d.cases, c.d.transactions, t.id, c.month), open: c.d.leads.filter(l => l.assignedTo === t.id && openLead(l)).length }))
    .sort((a, b) => b.closed - a.closed || b.collected - a.collected);
  if (!rows.length) return done(c, 'topagent', [{ t: 'p', text: 'No active sales staff yet.' }]);
  const best = rows[0];
  return done(c, 'topagent', [
    { t: 'p', text: best.closed || best.collected ? L(c, `${monthLabel(c.month)}: ${best.t.name} leads with ${plural(best.closed, 'file')} closed and ${money(best.collected)} collected.`, `${monthLabel(c.month)}: ${best.t.name} aage hain — ${best.closed} files close aur ${money(best.collected)} wasool.`) : L(c, `Nobody has closed a file yet in ${monthLabel(c.month)}.`, `${monthLabel(c.month)} mein abhi kisi ne file close nahi ki.`) },
    { t: 'rows', items: rows.slice(0, 6).map((r, i) => ({ label: `${i + 1}. ${r.t.name}`, value: `${plural(r.closed, 'file')} closed`, sub: `${money(r.collected)} collected · ${r.open} open leads`, tone: i === 0 && r.closed ? 'good' : undefined, go: 'perfwatch' })) },
  ], { follow: ['Who is falling behind?', 'What needs my attention today?'], go: [{ tab: 'perfwatch', label: 'Performance Watch' }, { tab: 'appraisal', label: 'Targets & Appraisal' }] });
}

function staffOverview(c: Ctx, t: TeamMember): Reply {
  const d = c.d;
  const open = d.leads.filter(l => l.assignedTo === t.id && openLead(l));
  const overdue = open.filter(l => l.nextFollowUp && l.nextFollowUp < d.todayIso).length;
  const untouched = open.filter(l => l.stage === 'New' && outboundCount(l) === 0).length;
  const closed = casesClosedBy(d.cases, t.id, c.month).length;
  const collected = collectedFor(d.cases, d.transactions, t.id, c.month);
  return done(c, 'person', [
    { t: 'h', text: `${t.name} · ${t.role} · ${specialtyLabel(t)}` },
    { t: 'rows', items: [
      { label: `Files closed in ${monthLabel(c.month)}`, value: `${closed} of ${t.monthlyQuota || 5} quota`, tone: closed >= (t.monthlyQuota || 5) ? 'good' : undefined },
      { label: 'Collected on their files', value: money(collected) },
      { label: 'Open leads', value: String(open.length) },
      { label: 'Follow-ups overdue', value: String(overdue), tone: overdue ? 'warn' : 'good' },
      { label: 'New leads never contacted', value: String(untouched), tone: untouched ? 'bad' : 'good' },
    ] },
  ], { follow: ['Who is my top agent this month?'], go: [{ tab: 'perfwatch', label: 'Performance Watch' }, { tab: 'hr', label: 'HR Department' }] });
}

function myNumbers(c: Ctx): Reply {
  if (c.head || !c.me) return topAgent(c);
  const t = c.me; const d = c.d;
  const closed = casesClosedBy(d.cases, t.id, c.month);
  const collected = collectedFor(d.cases, d.transactions, t.id, c.month);
  const commission = Math.round(collected * ((t.commissionPercent || 0) / 100));
  const quota = t.monthlyQuota || 5;
  const tgt = d.staffTargets.find(x => x.staffId === t.id && x.month === c.month);
  const rows = [
    { label: `Files closed in ${monthLabel(c.month)}`, value: `${closed.length} of ${quota}`, tone: (closed.length >= quota ? 'good' : undefined) as Tone | undefined },
    { label: 'Collected on your files', value: money(collected) },
    { label: `Commission (${t.commissionPercent || 0}%)`, value: money(commission), sub: 'paid with your salary' },
  ];
  if (t.bonusPerClose) rows.push({ label: 'Bonus per closed file', value: money(t.bonusPerClose * closed.length), tone: undefined, sub: `${money(t.bonusPerClose)} each` });
  if (tgt) rows.push({ label: 'Target set for you', value: `${tgt.casesTarget} files · ${money(tgt.revenueTarget)}`, tone: undefined });
  const left = Math.max(0, quota - closed.length);
  return done(c, 'mynumbers', [
    { t: 'p', text: left ? L(c, `You have closed ${closed.length} file${closed.length === 1 ? '' : 's'} this month; ${left} more to reach your quota.`, `Is mahine ${closed.length} files close hui hain; quota ke liye ${left} aur chahiye.`) : L(c, `You have reached your quota for ${monthLabel(c.month)} — well done.`, `Aap ne ${monthLabel(c.month)} ka quota poora kar liya — shabash.`) },
    { t: 'rows', items: rows },
  ], { follow: ['How can I hit my monthly target?', 'What should I do today?'], go: [{ tab: 'myportal', label: 'My Portal' }] });
}

function conversion(c: Ctx): Reply {
  const pool = myLeads(c);
  const month = c.d.todayIso.slice(0, 7);
  const inMonth = pool.filter(l => (l.createdAt || '').slice(0, 7) === month);
  const conv = pool.filter(l => l.stage === 'Converted').length, lost = pool.filter(l => l.stage === 'Lost').length;
  const rate = pool.length ? Math.round((conv / pool.length) * 100) : 0;
  const mConv = inMonth.filter(l => l.stage === 'Converted').length;
  return done(c, 'conversion', [
    { t: 'p', text: L(c, `${conv} of ${pool.length} leads became clients — ${rate}% overall. This month: ${mConv} of ${inMonth.length}.`, `${pool.length} leads mein se ${conv} client bane — kul ${rate}%. Is mahine: ${inMonth.length} mein se ${mConv}.`) },
    { t: 'rows', items: [{ label: 'Converted', value: String(conv), tone: 'good' }, { label: 'Lost', value: String(lost) }, { label: 'Still open', value: String(pool.filter(openLead).length) }] },
    { t: 'p', text: 'The biggest levers are replying within 15 minutes and following up on the days in the plan (1, 3, 7, 14, 30).' },
  ], { follow: ['How often should I follow up?', 'How do I close the sale?'], go: [{ tab: 'leads', label: 'Open Leads' }] });
}

function complaintsNow(c: Ctx): Reply {
  const list = c.d.complaints.filter(x => x.status !== 'Resolved' && (c.head || x.assignedTo === c.d.staffId));
  if (!list.length) return done(c, 'complaints', [{ t: 'p', text: L(c, 'No open complaints.', 'Koi complaint open nahi.') }], { go: [{ tab: 'complaints', label: 'Complaints & Feedback' }] });
  return done(c, 'complaints', [
    { t: 'p', text: L(c, `${plural(list.length, 'open complaint')}.`, `${list.length} complaints open hain.`) },
    { t: 'rows', items: list.slice(0, 6).map(x => ({ label: x.clientName, value: `${x.severity} · ${x.status}`, sub: `${x.category}${x.date ? ` · ${ago(daysAgo(c, x.date))}` : ''}`, tone: x.severity === 'High' ? 'bad' : 'warn', go: 'complaints' })) },
  ], { follow: ['The client is upset — what do I do?'], go: [{ tab: 'complaints', label: 'Complaints & Feedback' }] });
}

function requestsNow(c: Ctx): Reply {
  const list = c.d.requests.filter(r => (c.head ? r.status === 'Pending' : r.staffId === c.d.staffId));
  if (!list.length) return done(c, 'requests', [{ t: 'p', text: c.head ? L(c, 'No team requests are waiting.', 'Team ki koi request intezar mein nahi.') : L(c, 'You have not submitted any requests.', 'Aap ne koi request nahi bheji.') }], { follow: c.head ? [] : ['How do I ask for leave?'], go: [{ tab: c.head ? 'hr' : 'myportal', label: c.head ? 'HR Department' : 'My Portal' }] });
  return done(c, 'requests', [
    { t: 'p', text: c.head ? L(c, `${plural(list.length, 'team request')} waiting for you.`, `${list.length} requests aap ke faisle ki muntazir hain.`) : L(c, `You have ${plural(list.length, 'request')}.`, `Aap ki ${list.length} requests hain.`) },
    { t: 'rows', items: list.slice(-6).reverse().map(r => ({ label: c.head ? nameOf(c, r.staffId) : r.type, value: c.head ? r.type : r.status, sub: r.details?.slice(0, 80) || (r.leaveStartDate ? `${fmtDate(r.leaveStartDate)} → ${fmtDate(r.leaveEndDate)}` : ''), tone: (r.status === 'Pending' ? 'warn' : r.status === 'Approved' ? 'good' : 'bad') as Tone, go: c.head ? 'hr' : 'myportal' })) },
  ], { go: [{ tab: c.head ? 'hr' : 'myportal', label: c.head ? 'HR Department' : 'My Portal' }] });
}

function deskNow(c: Ctx): Reply {
  const staff = c.d.team.filter(t => !t.employmentStatus || t.employmentStatus === 'Active');
  const k = c.ent.country;
  const desk = k ? deskOf(k.id) : null;
  const pick = k && desk ? staff.filter(t => (t.specialties || []).includes(desk)) : [];
  if (k) {
    if (!desk) return done(c, 'desk', [{ t: 'p', text: `${k.name} files do not belong to a specialist desk — any all-rounder can take them.` }], { go: [{ tab: 'hr', label: 'HR Department' }] });
    return done(c, 'desk', [
      { t: 'p', text: pick.length ? `${k.name} files go to the ${desk} desk: ${pick.map(t => t.name).join(', ')}.` : `Nobody is marked as an expert for ${k.name} yet. You can set it on an employee’s profile in HR.` },
    ], { go: [{ tab: 'hr', label: 'HR Department' }] });
  }
  const rows = staff.filter(t => t.department === 'Sales').map(t => ({ label: t.name, value: specialtyLabel(t) }));
  return done(c, 'desk', [{ t: 'p', text: 'Who handles which country:' }, { t: 'rows', items: rows.length ? rows : [{ label: 'No sales staff', value: '' }] }], { go: [{ tab: 'hr', label: 'HR Department' }] });
}

function toursNow(c: Ctx): Reply {
  const list = c.d.groupTours.filter(t => t.status !== 'Closed' && t.endDate >= c.d.todayIso).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!list.length) return done(c, 'tours', [{ t: 'p', text: 'There are no open group tours coming up.' }], { go: [{ tab: 'grouptours', label: 'Group Tours' }] });
  return done(c, 'tours', [
    { t: 'p', text: `${plural(list.length, 'group tour')} coming up.` },
    { t: 'rows', items: list.slice(0, 5).map(t => ({ label: `${t.name} · ${t.destination}`, value: t.status, sub: `${fmtDate(t.startDate)} → ${fmtDate(t.endDate)} · ${t.capacity} seats · ${money(t.packagePrice)}`, tone: t.status === 'Limited Seats' ? 'warn' : undefined, go: 'grouptours' })) },
  ], { follow: ['How do I add a client to a group tour?'], go: [{ tab: 'grouptours', label: 'Group Tours' }] });
}


function leadsSummary(c: Ctx): Reply {
  const pool = myLeads(c);
  const open = pool.filter(openLead);
  const due = open.filter(l => l.nextFollowUp && l.nextFollowUp <= c.d.todayIso).length;
  const stages = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'] as const;
  return done(c, 'leads', [
    { t: 'p', text: L(c, `${c.head ? 'The team has' : 'You have'} ${plural(open.length, 'open lead')} out of ${pool.length}; ${due} ${due === 1 ? 'needs' : 'need'} a follow-up today or earlier.`, `${open.length} open leads hain (kul ${pool.length}); ${due} ka follow-up aaj ya pehle ka hai.`) },
    { t: 'rows', items: stages.map(s => ({ label: s, value: String(pool.filter(l => l.stage === s).length), tone: (s === 'Converted' ? 'good' : undefined) as Tone | undefined, go: 'leads' })) },
  ], { follow: ['What should I do today?', 'What is my conversion rate?'], go: [{ tab: 'leads', label: 'Open Leads' }] });
}

function casesSummary(c: Ctx): Reply {
  const list = myCases(c);
  const active = list.filter(k => k.status === 'Active');
  const owedAll = sum(list.map(k => caseDue(k, c.d.appointments, c.d.todayIso).outstanding));
  return done(c, 'cases', [
    { t: 'p', text: L(c, `${c.head ? 'There are' : 'You have'} ${plural(list.length, 'case')}: ${active.length} active, ${list.filter(k => k.status === 'Approved').length} approved, ${list.filter(k => k.status === 'Refused').length} refused.`, `Kul ${list.length} cases: ${active.length} active, ${list.filter(k => k.status === 'Approved').length} approved, ${list.filter(k => k.status === 'Refused').length} refused.`) },
    { t: 'rows', items: [{ label: 'Clients still owe', value: money(owedAll), tone: (owedAll ? 'warn' : 'good') as Tone, go: c.head ? 'billing' : 'cases' }] },
    ...(active.length ? [{ t: 'rows', items: active.slice(0, 5).map(k => ({ label: `${k.name} · ${k.queryNo || ''}`, value: k.caseStage, sub: k.destination, go: 'cases' })) } as Block] : []),
  ], { follow: ['Who owes us money?', 'How do I record a payment?'], go: [{ tab: 'cases', label: 'Open Cases' }] });
}

function behind(c: Ctx): Reply {
  const staff = c.d.team.filter(t => (!t.employmentStatus || t.employmentStatus === 'Active') && t.department === 'Sales');
  const rows = staff.map(t => {
    const open = c.d.leads.filter(l => l.assignedTo === t.id && openLead(l));
    return { t, overdue: open.filter(l => l.nextFollowUp && l.nextFollowUp < c.d.todayIso).length, untouched: open.filter(l => l.stage === 'New' && outboundCount(l) === 0).length, closed: casesClosedBy(c.d.cases, t.id, c.month).length };
  }).map(r => ({ ...r, score: r.overdue + r.untouched * 2 })).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  if (!rows.length) return done(c, 'behind', [{ t: 'p', text: L(c, 'Nobody is behind right now — no overdue follow-ups and no untouched new leads.', 'Abhi koi peeche nahi — na follow-up late hai na koi naya lead beghair rabte ke.') }], { go: [{ tab: 'perfwatch', label: 'Performance Watch' }] });
  return done(c, 'behind', [
    { t: 'p', text: L(c, 'These people have the most leads waiting on them:', 'In logon ke paas sab se zyada leads intezar mein hain:') },
    { t: 'rows', items: rows.slice(0, 6).map(r => ({ label: r.t.name, value: `${r.overdue} overdue · ${r.untouched} untouched`, sub: `${r.closed} closed this month`, tone: (r.untouched > 2 || r.overdue > 5 ? 'bad' : 'warn') as Tone, go: 'perfwatch' })) },
  ], { follow: ['Who is my top agent this month?'], go: [{ tab: 'perfwatch', label: 'Performance Watch' }] });
}

// ---------- writing things for the agent ----------
const POST_NAME: Record<string, string> = { 'Türkiye': 'Türkiye' };
function postReply(c: Ctx): Reply {
  const kind: PostKind = has(c, 'checklist', 'document') ? 'checklist' : has(c, 'guarantee', 'myth') ? 'myth' : has(c, 'referral') ? 'referral' : has(c, 'tip', 'update', 'news', 'advice') ? 'update' : has(c, 'story', 'review', 'testimonial') ? 'story' : 'consultation';
  const wantToday = /\b(of the day|today'?s|aaj ki)\b/.test(c.low) && !c.ent.country;
  const country = c.ent.country?.id || (c.mem.country && c.mem.country !== 'any' ? c.mem.country : '');
  const lang = c.ur ? 'Roman Urdu' : 'English';
  const shifted = new Date(Date.parse(c.d.todayIso + 'T00:00:00Z') + c.variant * 86400000).toISOString().slice(0, 10);
  const todays = postOfTheDay(shifted, lang, c.me?.name, c.me?.phone);
  const dest = wantToday || !country ? todays.destination : (POST_NAME[country] || country);
  const k2: PostKind = wantToday || (!country && !has(c, 'checklist', 'document', 'guarantee', 'myth', 'referral', 'tip', 'story')) ? todays.kind : kind;
  const text = buildPost({ destination: dest, kind: k2, lang, agentName: c.me?.name, phone: c.me?.phone });
  return done(c, 'post', [
    { t: 'p', text: L(c, `Here is a ready ${dest} post you can put on your WhatsApp Status or in your groups.`, `Yeh ${dest} ki tayyar post hai — WhatsApp Status ya groups mein lagayein.`) },
    { t: 'say', text, label: `${dest} post` },
    { t: 'note', text: 'Edit anything you like. Never post a client’s name, photo or documents without permission, and never promise a visa.', tone: 'info' },
  ], { follow: [`Write a ${dest} checklist post`, 'Write a post in Roman Urdu', 'Write a post about not guaranteeing visas'], go: [{ tab: 'coach', label: 'Posts in Sales Coach' }], mem: { country: c.ent.country?.id || dest } });
}

function messageReply(c: Ctx): Reply {
  const lead = c.ent.lead || (c.mem.leadId ? c.d.leads.find(l => l.id === c.mem.leadId && (c.head || l.assignedTo === c.d.staffId)) : undefined);
  const kind: ScriptKind = has(c, 'first', 'new', 'introduction', 'intro') ? 'first' : has(c, 'close', 'advance', 'convert', 'sign') ? 'close' : has(c, 'revive', 'old', 'cold') ? 'revive' : has(c, 'escalate') ? 'escalate' : has(c, 'value', 'checklist') ? 'value' : 'followup';
  if (has(c, 'balance', 'reminder', 'remind', 'unpaid', 'owe') ) {
    const e = ENTRY_BY_ID['balance'];
    return entryReply({ ...c, detail: false }, e);
  }
  if (lead) {
    const text = scriptFor(lead, kind, c.me?.name || 'your consultant', c.d.followUpTemplates);
    return done(c, 'message', [
      { t: 'p', text: L(c, `Here is ${kind === 'first' ? 'a first' : kind === 'close' ? 'a closing' : kind === 'revive' ? 'a re-engagement' : 'the next follow-up'} message for ${firstName(lead.name)}.`, `Yeh ${firstName(lead.name)} ke liye message hai.`) },
      { t: 'say', text, label: `Message for ${firstName(lead.name)}` },
      { t: 'note', text: 'Send it on WhatsApp after your call, then set the next follow-up date.', tone: 'info' },
    ], { follow: ['The client does not reply', 'How often should I follow up?'], go: [{ tab: 'leads', label: 'Open Leads' }], mem: { leadId: lead.id } });
  }
  const dest = c.ent.country?.id || '[country]';
  const generic = kind === 'first' ? ENTRY_BY_ID['firstmsg'] : kind === 'close' ? ENTRY_BY_ID['closing'] : kind === 'revive' ? ENTRY_BY_ID['revive'] : null;
  if (generic) return entryReply(c, generic);
  const step = CADENCE[c.variant ? 2 : 1];
  const text = bracket(fill(step.say, { name: '[client name]', destination: dest, agent: c.me?.name || '[your name]' }));
  return done(c, 'message', [
    { t: 'p', text: 'Here is a follow-up message you can adapt. Tell me the client’s name and I will write it for them.' },
    { t: 'say', text, label: 'Follow-up message' },
  ], { follow: ['Write a first message for a new lead', 'Write a closing message'] });
}

// ---------- small talk and safety ----------
const GREET = /^\s*(hi|hello|hey|hii+|salam|salaam|assalam|assalamo|assalamualaikum|assalam o alaikum|aoa|asalam|good (morning|afternoon|evening)|yo)\b/i;
const THANKS = /\b(thanks|thank you|thankyou|thx|shukriya|shukria|jazak|jazakallah)\b/i;
const WHO = /\b(who are you|what are you|your name|kaun ho|kon ho|aap kaun|tum kaun|are you (ai|a bot|chatgpt|real))\b/i;
const CAPABLE = /\b(what can you do|how can you help|help me|can you help|kya kar sakte|kya kya|what do you know|how do you work|abilities|features)\b|^\s*(i |please )?(need |want )?(some )?(help|madad)( me| karo| chahiye)?\s*[?!.]*$/i;
const FAKE = /\b(fake|forge|forged|forgery|jaali|jali|edit(ed|ing)?|tamper|photoshop|dummy|bogus|fabricate|manipulate|false)\b.*\b(bank|statement|document|salary|letter|certificate|stamp|noc|ticket|booking|paper|passport|balance)\b|\b(bank|statement|document|salary|letter|certificate|noc|ticket|booking|paper)\b.*\b(fake|forge|forged|jaali|jali|tamper|photoshop|dummy|bogus|fabricate)\b|\b(show|dikha)\w*\b.*\b(borrowed|udhaar|temporary|fake)\b.*\b(money|funds|paise|paisay|balance)\b/i;

function smallTalk(c: Ctx): Reply | null {
  const name = c.me ? firstName(c.me.name) : 'Head Manager';
  if (FAKE.test(c.raw)) {
    return done(c, 'refuse', [
      { t: 'p', text: 'I cannot help with fake, edited or borrowed documents or funds. It is dishonest, embassies check, and one discovery can mean a long ban for the client — and it would put the company at risk too.' },
      { t: 'p', text: 'What I can do: explain how to build a genuine, strong file — real income, real savings over time, a clear cover letter. If the profile is weak, the honest answer is to improve it first or wait.' },
      { t: 'note', text: 'If a client asks you for this, say no politely and tell your manager.', tone: 'warn' },
    ], { follow: ['Bank statement or funds are a problem', 'How do I explain a large deposit?'] });
  }
  if (WHO.test(c.raw)) {
    return done(c, 'who', [
      { t: 'p', text: 'I am the GoGlobe assistant built into this portal. I do not use any outside AI service or key — I read your live portal data and the company’s sales and visa guide, and I answer in English or Roman Urdu.' },
      { t: 'p', text: 'I am not a general chatbot, so I do not know everything. When I am not sure I say so, and I never invent a fee, a waiting time or an embassy rule.' },
    ], { follow: ['What can you do?', ...(c.head ? STARTERS_HEAD.slice(0, 2) : STARTERS_STAFF.slice(0, 2))] });
  }
  if (CAPABLE.test(c.raw)) {
    const ex = c.head
      ? ['“What needs my attention today?” — your day at a glance', '“How much have we received this month?” / “Who owes us money?”', '“Who is my top agent?” / “How is Ahmed doing?”', '“Finance in one minute” — the four numbers explained', '“Documents for Schengen”, “Why do UK visas get refused?”', '“Write a post for UK” / “How do I run payroll?”']
      : ['“What should I do today?” — who to contact, with a ready message', '“Tell me about [client name]” — stage, next step and message', '“The client says the fee is too high” — what to say', '“Documents for UK”, “Why do Schengen visas get refused?”', '“Write a first message for a UK lead”, “Write a post”', '“How do I record a payment?” — where things are in the portal'];
    return done(c, 'capable', [
      { t: 'p', text: L(c, 'Ask me in plain English or Roman Urdu. For example:', 'Seedhi English ya Roman Urdu mein poochein. Jaise:') },
      { t: 'bullets', items: ex },
      { t: 'note', text: 'I answer from your portal data and the company guide. Say “shorter”, “in Urdu” or “more detail” to change my last answer.', tone: 'info' },
    ], { follow: c.head ? STARTERS_HEAD.slice(0, 3) : STARTERS_STAFF.slice(0, 3) });
  }
  if (THANKS.test(c.raw) && c.toks.length <= 3) return done(c, 'thanks', [{ t: 'p', text: L(c, 'You are welcome! Ask me anything else any time.', 'Khushi hui! Jab chahein aur poochein.') }]);
  if (GREET.test(c.raw) && c.toks.length <= 3) {
    return done(c, 'greet', [
      { t: 'p', text: `Assalam o Alaikum${name ? `, ${name}` : ''}! ${c.head ? 'What would you like to know about the business today?' : 'How can I help with your leads and clients today?'}` },
    ], { follow: c.head ? STARTERS_HEAD.slice(0, 4) : STARTERS_STAFF.slice(0, 4) });
  }
  return null;
}

// ---------- the fallback ----------
function unknown(c: Ctx): Reply {
  const near = INDEX.search(c.clean, 3).map(h => ENTRY_BY_ID[h.id]).filter(Boolean);
  const blocks: Block[] = [
    { t: 'p', text: L(c, 'I am not sure I understood that, and I would rather say so than guess.', 'Mujhe yaqeen nahi ke main samjha, aur andaza lagane se behtar hai ke saaf bata doon.') },
  ];
  if (near.length) blocks.push({ t: 'p', text: L(c, 'The closest things I know about:', 'Sab se qareeb jo main jaanta hoon:') }, { t: 'bullets', items: near.map(e => e.title) });
  blocks.push({ t: 'p', text: 'You can ask about your leads and cases, today’s tasks, money (Head Manager), what to say to a client, a country’s visa process and documents, or where something is in the portal.' });
  blocks.push({ t: 'note', text: 'Try a shorter question, or include the client’s name or country. If it is a visa rule I do not have, check with your manager or the embassy site.', tone: 'info' });
  return done(c, 'unknown', blocks, { follow: near.map(e => e.title).slice(0, 2).concat(c.head ? ['What needs my attention today?'] : ['What should I do today?']) });
}

// ---------- the main entry ----------
const MODS = /^(inurdu|inenglish|again|shorter|moredetail)$/;

export interface Opts { short?: boolean; detail?: boolean; variant?: number }

export function respond(question: string, data: AssistantData, mem0: Memory = NEW_MEMORY): Reply {
  const raw = (question || '').trim();
  let mem: Memory = { ...NEW_MEMORY, ...mem0, turns: (mem0.turns || 0) + 1 };
  const toks = tokens(raw);
  const rest = toks.filter(t => !MODS.test(t));
  const opts: Opts = {};
  if (toks.includes('inurdu')) mem.pref = 'ur';
  if (toks.includes('inenglish')) mem.pref = 'en';
  if (toks.includes('shorter')) opts.short = true;
  if (toks.includes('moredetail')) opts.detail = true;
  let q = raw;
  // "in Urdu", "shorter", "again": do the last question again, changed
  if (!rest.length && toks.length && mem.lastQ) {
    q = mem.lastQ;
    if (toks.includes('again')) opts.variant = 1;
  }
  return run(q, data, mem, opts);
}

function run(raw: string, d: AssistantData, mem: Memory, opts: Opts): Reply {
  const toks = tokens(raw);
  const detected = looksUrdu(raw);
  const ur = mem.pref === 'ur' || (mem.pref === 'auto' && detected) || toks.includes('inurdu');
  const me = d.role === 'staff' ? d.team.find(t => t.id === d.staffId) || null : null;
  const base = { d, raw, low: raw.toLowerCase(), toks, set: new Set(toks), ur, short: !!opts.short, detail: !!opts.detail, variant: opts.variant || 0, mem, me, head: d.role === 'head', month: d.todayIso.slice(0, 7) };
  const ent = detect(base);
  let clean = raw;
  for (const n of ent.names.filter(x => x && x.length >= 3).sort((a, b) => b.length - a.length)) clean = clean.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
  const c: Ctx = { ...base, ent, clean };

  const talk = smallTalk(c);
  if (talk) return talk;
  if (!toks.length) return done(c, 'empty', [{ t: 'p', text: L(c, 'Ask me about your leads, cases, money or how to handle a client.', 'Apne leads, cases, paisay ya client sambhalne ke baare mein poochein.') }], { follow: c.head ? STARTERS_HEAD.slice(0, 3) : STARTERS_STAFF.slice(0, 3) });

  const q = (...w: string[]) => has(c, ...w);
  // "how do I …" questions are about the portal or a skill, not about today's numbers
  const howTo = /\b(how (do|can|should|would|to|does|did)|kaise|kese|kaisay|tareeqa|tarika|steps? to)\b/i.test(raw) && !q('howmuch');
  const hits = asked(c);
  const top = hits[0];

  // 1. writing something for the agent
  const writing = q('write', 'draft', 'compose', 'make', 'create', 'generate', 'send');
  if (q('post', 'status', 'caption') && (writing || q('today', 'ready', 'day')) && !q('portal')) return postReply(c);
  if (writing && q('message', 'script', 'reply', 'template', 'followup', 'remind', 'intro', 'closing')) return messageReply(c);

  // 2. a client or lead named in the question
  const strongKnowledge = !!top && top.score >= 3.4;
  if (ent.kase && !q('write') && !(howTo && !q('tell', 'status', 'about'))) {
    if (q('owe', 'pending', 'unpaid', 'paid', 'payment', 'pay', 'due', 'fee', 'tell', 'status', 'show', 'about', 'case', 'detail', 'info') || toks.length <= 2) return caseReply(c, ent.kase);
  }
  if (ent.lead && !howTo) {
    if (strongKnowledge && !q('tell', 'status', 'about', 'show', 'detail', 'info', 'next') ) return entryReply(c, top.e, 'knowledge');
    if (!(ent.kase && q('paid', 'payment', 'owe'))) return leadReply(c, ent.lead);
  }
  if (ent.person) return staffOverview(c, ent.person);

  // 3. the portal's own numbers
  if (!howTo) {
    if (q('today', 'now') && q('what', 'followup', 'call', 'task', 'plan', 'priority', 'attention', 'need', 'urgent', 'contact', 'work', 'first', 'next', 'pending', 'due') && !q('post', 'status', 'client', 'visa')) return dayPlan(c);
    if (q('attention')) return dayPlan(c);
    if (q('lead') && q('followup') && q('need', 'due', 'which', 'today', 'pending', 'overdue', 'list', 'show')) return dayPlan(c);
    if (q('next') && q('action', 'step') && !q('visa')) return dayPlan(c);
    if (q('lead') && q('new') && !q('write')) return newLeads(c);
    if (q('lead') && q('howmuch', 'my', 'list', 'show', 'all', 'total') && !q('new')) return leadsSummary(c);
    if (q('case') && q('howmuch', 'my', 'list', 'show', 'total', 'active', 'open')) return casesSummary(c);
    if (q('bank') && q('pending', 'money', 'cash', 'account', 'have')) return bankNow(c);
    if (q('request') && q('pending', 'waiting', 'leave', 'team', 'any', 'open', 'my')) return requestsNow(c);
    if (q('complaint') && q('open', 'pending', 'any', 'howmuch', 'unresolved', 'list', 'show', 'today')) return complaintsNow(c);
    if (c.head && q('behind', 'falling', 'weak', 'slow', 'poor', 'lazy', 'worst') && q('agent', 'team', 'who', 'staff', 'employee')) return behind(c);
    if ((q('top', 'best') && q('agent', 'team', 'performer', 'seller', 'employee', 'closer', 'sales', 'staff')) || (c.head && q('performance', 'ranking', 'leaderboard'))) return topAgent(c);
    if (q('conversion') || (q('convert') && q('rate', 'ratio', 'percent', 'howmuch'))) return conversion(c);
    if ((q('my') || !c.head) && q('commission', 'bonus', 'quota', 'target', 'earn', 'closed') && !q('client', 'tell', 'what', 'fee')) return myNumbers(c);
    if (q('who') && q('handle', 'expert', 'specialist', 'desk', 'take', 'cover')) return deskNow(c);
    if (q('grouptour') && q('upcoming', 'open', 'seat', 'howmuch', 'list', 'show', 'next', 'available', 'any')) return toursNow(c);
    if (q('appoint') && q('today', 'tomorrow', 'week', 'upcoming', 'next', 'my', 'list', 'show', 'howmuch', 'any', 'what', 'when', 'scheduled', 'pending') && !q('book', 'missed', 'miss', 'client', 'absent', 'cancel', 'reschedule')) return appointmentsNow(c);
    if (q('owe') || q('unpaid')) return owed(c);
    if (q('overdue', 'pending') && q('client', 'payment', 'case', 'money', 'pay', 'howmuch', 'who')) return owed(c);
    if (c.head && q('payout', 'payroll', 'salary', 'commission', 'pay') && q('due', 'upcoming', 'out', 'pending', 'embassy', 'howmuch', 'owe') && !q('my')) return payoutsNow(c);
    if (q('received', 'spent', 'profit', 'revenue', 'income', 'earned', 'sale') && (q('month', 'last', 'howmuch', 'total', 'sofar', 'today') || /\b(our|we|hamar\w+|company|business|firm)\b/i.test(raw)) && !q('my')) return moneyNow(c);
  }

  // 4. a country
  const hard = q('document', 'checklist', 'refusal', 'process', 'fund', 'savings', 'howlong', 'processing', 'sell', 'pitch', 'convince', 'tip', 'mistake', 'type', 'coverletter');
  const soft = q('student', 'work', 'family', 'spouse', 'parents', 'fee', 'bankstatement', 'business', 'step', 'apply', 'how');
  const strongSales = !!top && top.e.kind === 'sales' && top.score >= 3.4;
  if (ent.country) {
    const k = ent.country;
    const only = c.toks.filter(t => !k.words.includes(t) && !['what', 'how', 'visa', 'tell', 'about', 'info'].includes(t)).length === 0;
    if (hard || only) return countryReply(c, k);
    if (!strongSales && (soft || !top || top.score < 2.4)) return countryReply(c, k);
  }

  // "and the refusals?" right after a country answer
  if (!ent.country && c.mem.country && (/^\s*(and|aur|what about|how about|also|phir)\b/i.test(raw) || toks.length <= 2) && (hard || q('student', 'work', 'family', 'fee'))) {
    const k = COUNTRIES.find(x => x.id === c.mem.country);
    if (k) return countryReply({ ...c, ent: { ...c.ent, country: k } }, k);
  }

  // 5. what we know
  if (top) {
    if (top.e.id === 'g-documents' && !ent.country && !c.mem.country) {
      return done(c, 'docs', [{ t: 'p', text: L(c, 'Which country? I will give you the checklist.', 'Kis mulk ke liye? Main checklist de dunga.') }], { follow: ['Documents for UK', 'Documents for Schengen', 'Documents for USA', 'Documents for Canada'] });
    }
    return entryReply(c, top.e, top.e.kind === 'portal' ? 'howto' : 'knowledge', hits[1] && hits[1].score > top.score * 0.75 ? [hits[1].e.title] : []);
  }
  // remembered country: "and the refusals?"
  if (c.mem.country && q('document', 'checklist', 'refusal', 'process', 'fund', 'tip', 'type', 'howlong')) {
    const k = COUNTRIES.find(x => x.id === c.mem.country);
    if (k) return countryReply({ ...c, ent: { ...c.ent, country: k } }, k);
  }
  return unknown(c);
}

export function startersFor(role: 'head' | 'staff'): string[] { return role === 'head' ? STARTERS_HEAD : STARTERS_STAFF; }
export { normalize };
