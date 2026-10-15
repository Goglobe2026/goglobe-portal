import { COACH_SYSTEM } from './coach';

// ---------------------------------------------------------------------------
// The "Ask the coach" assistant's connection to an AI service (server only).
// Set ONE of these in the hosting provider's environment variables:
//   ANTHROPIC_API_KEY  — Claude   (model: COACH_MODEL, default claude-haiku-5-5)
//   OPENAI_API_KEY     — ChatGPT  (model: COACH_OPENAI_MODEL, default gpt-4o-mini)
// Optional: COACH_PROVIDER=anthropic|openai when both are set, COACH_API_BASE to
// route through a proxy. With no key the assistant answers from the built-in guide.
// Client names and phone numbers are never sent: only the country, stage and a few
// counts of the lead being discussed.
// ---------------------------------------------------------------------------

export type Provider = 'anthropic' | 'openai';
export function coachProvider(): Provider | null {
  const a = !!process.env.ANTHROPIC_API_KEY, o = !!process.env.OPENAI_API_KEY;
  const pick = (process.env.COACH_PROVIDER || '').toLowerCase();
  if (pick === 'openai' && o) return 'openai';
  if (pick === 'anthropic' && a) return 'anthropic';
  return a ? 'anthropic' : o ? 'openai' : null;
}
export function coachModel(p: Provider) {
  return p === 'anthropic' ? (process.env.COACH_MODEL || 'claude-haiku-5-5') : (process.env.COACH_OPENAI_MODEL || 'gpt-4o-mini');
}

export interface Turn { role: 'user' | 'assistant'; text: string }
export interface LeadContext { destination?: string; stage?: string; daysOld?: number; followUps?: number; interest?: string; source?: string }

const clip = (s: unknown, n: number) => String(s ?? '').replace(/\u0000/g, '').slice(0, n);

export function cleanContext(c: unknown): LeadContext | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const x = c as Record<string, unknown>;
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(9999, Math.round(Number(v)))) : undefined);
  const out: LeadContext = {};
  if (x.destination) out.destination = clip(x.destination, 40);
  if (x.stage) out.stage = clip(x.stage, 20);
  if (x.interest) out.interest = clip(x.interest, 20);
  if (x.source) out.source = clip(x.source, 40);
  const d = num(x.daysOld); if (d !== undefined) out.daysOld = d;
  const f = num(x.followUps); if (f !== undefined) out.followUps = f;
  return Object.keys(out).length ? out : undefined;
}
export function cleanHistory(h: unknown): Turn[] {
  if (!Array.isArray(h)) return [];
  const turns: Turn[] = h.slice(-6).map(t => ({ role: (t && t.role === 'assistant' ? 'assistant' : 'user') as Turn['role'], text: clip(t && t.text, 1500) })).filter(t => t.text.trim());
  // must start with the user and alternate
  const out: Turn[] = [];
  for (const t of turns) { if (!out.length && t.role !== 'user') continue; if (out.length && out[out.length - 1].role === t.role) { out[out.length - 1] = t; continue; } out.push(t); }
  if (out.length && out[out.length - 1].role === 'user') out.pop();   // the new question is added by the caller
  return out;
}

export function contextLine(c?: LeadContext) {
  if (!c) return '';
  const bits = [c.destination && `destination ${c.destination}`, c.stage && `stage ${c.stage}`, c.daysOld !== undefined && `${c.daysOld} days since the lead arrived`, c.followUps !== undefined && `${c.followUps} follow-ups sent so far`, c.interest && c.interest !== 'Unrated' && `interest ${c.interest}`, c.source && `source ${c.source}`].filter(Boolean);
  return bits.length ? `\n\nThe lead being discussed: ${bits.join(', ')}.` : '';
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await r.text();
    let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
    if (!r.ok) throw new Error(`AI service answered ${r.status}${json?.error?.message ? `: ${String(json.error.message).slice(0, 160)}` : ''}`);
    return json;
  } finally { clearTimeout(timer); }
}

export async function askAi(question: string, history: Turn[], context?: LeadContext, extraSystem = ''): Promise<{ text: string; provider: Provider; model: string }> {
  const provider = coachProvider();
  if (!provider) throw new Error('No AI key is set up');
  const model = coachModel(provider);
  const system = COACH_SYSTEM + contextLine(context) + (extraSystem ? `\n\n${extraSystem}` : '');
  const turns = [...history, { role: 'user' as const, text: question }];
  if (provider === 'anthropic') {
    const base = (process.env.COACH_API_BASE || 'https://api.anthropic.com').replace(/\/$/, '');
    const j = await post(`${base}/v1/messages`, { 'x-api-key': process.env.ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01' },
      { model, max_tokens: 700, system, messages: turns.map(t => ({ role: t.role, content: t.text })) });
    const text = (j?.content || []).map((c: any) => (c && c.type === 'text' ? c.text : '')).join('').trim();
    if (!text) throw new Error('The AI service sent an empty answer');
    return { text, provider, model };
  }
  const base = (process.env.COACH_API_BASE || 'https://api.openai.com').replace(/\/$/, '');
  const j = await post(`${base}/v1/chat/completions`, { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    { model, max_tokens: 700, messages: [{ role: 'system', content: system }, ...turns.map(t => ({ role: t.role, content: t.text }))] });
  const text = String(j?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('The AI service sent an empty answer');
  return { text, provider, model };
}

// ---- a small per-person limit so one browser tab cannot run up the bill ----
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max = 40, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list);
  return false;
}
