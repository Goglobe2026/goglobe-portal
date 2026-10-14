import crypto from 'crypto';
import type { ReportConfig, Recipient } from './reportConfig';
import { templateVars, type DailyReport } from './dailyReport';

export interface SendResult { name: string; phone: string; ok: boolean; error?: string; id?: string }

const API_BASE = () => process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v25.0';
const CALLMEBOT_BASE = () => process.env.CALLMEBOT_BASE || 'https://api.callmebot.com';
// Bird keys carry their region: bk_eu1_… talks to eu1.platform.bird.com, anything else to us1. BIRD_API_BASE overrides (tests).
const birdBase = (key: string) => {
  if (process.env.BIRD_API_BASE) return process.env.BIRD_API_BASE.replace(/\/+$/, '');
  const m = /^bk_([a-z]{2,4}\d)_/.exec(key);
  return `https://${m ? m[1] : 'us1'}.platform.bird.com`;
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function http(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), init.timeoutMs || 20000);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

// Meta's error codes, in plain words.
function explainMeta(status: number, body: any): string {
  const e = body?.error || {};
  const code = Number(e.code); const sub = Number(e.error_subcode);
  const msg = String(e.error_user_msg || e.message || '').slice(0, 220);
  if (status === 401 || code === 190) return 'WhatsApp rejected the access token — it is wrong or has expired. Create a new permanent token and save it here.';
  if (code === 131030) return 'This number is not on the allowed list yet. With a test number, add it under Meta → WhatsApp → API Setup → "To".';
  if (code === 132001) return 'Template not found. Check the template name and language, and that Meta has approved it.';
  if (code === 132000 || code === 132012 || code === 132018) return 'The template does not match what the portal sends. Use exactly the template text shown on this page (or switch to the compact style).';
  if (code === 131047 || code === 131049) return 'WhatsApp only allows free text within 24 hours of that person writing to you. Use template mode.';
  if (code === 131026) return 'This number cannot receive WhatsApp messages (or is not on WhatsApp).';
  if (code === 100 && /phone number id|object with ID/i.test(msg)) return 'The phone number ID looks wrong. Copy it again from Meta → WhatsApp → API Setup.';
  if (code === 80007 || code === 130429) return 'WhatsApp is rate-limiting this number. It will retry later.';
  return msg ? `WhatsApp said: ${msg}${sub ? ` (code ${code}/${sub})` : code ? ` (code ${code})` : ''}` : `WhatsApp returned an error (HTTP ${status}).`;
}

async function sendCloud(cfg: ReportConfig, r: Recipient, report: DailyReport): Promise<SendResult> {
  const base = { name: r.name, phone: r.phone };
  const url = `${API_BASE()}/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
  const body = cfg.mode === 'text'
    ? { messaging_product: 'whatsapp', recipient_type: 'individual', to: r.phone, type: 'text', text: { preview_url: false, body: report.text.slice(0, 4000) } }
    : {
        messaging_product: 'whatsapp', recipient_type: 'individual', to: r.phone, type: 'template',
        template: {
          name: cfg.templateName, language: { code: cfg.language || 'en' },
          components: [{ type: 'body', parameters: templateVars(report, cfg.templateStyle).map(text => ({ type: 'text', text })) }],
        },
      };
  try {
    const res = await http(url, { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.messages?.[0]?.id) return { ...base, ok: true, id: json.messages[0].id };
    return { ...base, ok: false, error: explainMeta(res.status, json) };
  } catch (e) {
    return { ...base, ok: false, error: (e as Error).name === 'AbortError' ? 'WhatsApp did not answer in time.' : `Could not reach WhatsApp (${(e as Error).message}).` };
  }
}

async function sendCallMeBot(r: Recipient, report: DailyReport): Promise<SendResult> {
  const base = { name: r.name, phone: r.phone };
  const text = report.text.slice(0, 1800);
  const url = `${CALLMEBOT_BASE()}/whatsapp.php?phone=${encodeURIComponent('+' + r.phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(r.key || '')}`;
  try {
    const res = await http(url, { method: 'GET' });
    const body = (await res.text().catch(() => '')).slice(0, 400);
    if (res.ok && !/error|apikey is invalid|not.*activated/i.test(body)) return { ...base, ok: true };
    return { ...base, ok: false, error: `CallMeBot said: ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || `HTTP ${res.status}`}` };
  } catch (e) {
    return { ...base, ok: false, error: `Could not reach CallMeBot (${(e as Error).message}).` };
  }
}

// ---- Bird -------------------------------------------------------------------------------------------
// Bird accepts a send with 202 and delivers later, so after the send we look the message up a few times:
// a wallet with no balance or a number that is not on WhatsApp only shows up there, not in the 202.

function explainBirdHttp(status: number, body: any): string {
  const e = body?.error || {};
  const name = String(e.name || ''); const code = String(e.code || '');
  const msg = String(e.message || '').slice(0, 220);
  if (status === 401) return 'Bird rejected the API key — it is wrong, was revoked, or was pasted incompletely. Create a new key in Bird and save it here.';
  if (status === 403 || code === 'E02035') return 'This Bird API key is not allowed to send WhatsApp messages. Create a key that has WhatsApp send and read permission.';
  if (status === 402 || e.type === 'billing_error') return 'Your Bird wallet has no balance. Top it up in Bird → Billing; the portal will retry.';
  if (status === 421) return 'This Bird API key belongs to a different Bird region than the one the portal called. Paste the key exactly as Bird shows it (it starts with bk_us1_ or bk_eu1_).';
  if (status === 429) return 'Bird is rate-limiting this account. It will retry later.';
  if (status >= 500) return `Bird had a problem on its side (HTTP ${status}). It will retry later.`;
  if (code === 'E15044' || name === 'WhatsAppServiceWindowClosed') return 'WhatsApp only allows free text within 24 hours of that person writing to your Bird number. Use template mode.';
  if (name === 'WhatsAppSenderNotFound' || name === 'WhatsAppSenderRequired') return 'Bird does not recognise the sending number. Use the exact number shown under Bird → WhatsApp → Numbers.';
  if (name === 'WhatsAppSenderWABAMismatch') return 'The template was created on a different WhatsApp Business Account than the sending number. Create the template on the same account as the number.';
  if (name === 'WhatsAppTemplateParameterMismatch') return 'The template does not match what the portal sends. Use exactly the template text shown on this page (or switch to the compact style).';
  if (name === 'WhatsAppInvalidRecipient') return 'That is not a valid WhatsApp number.';
  if (status === 404 || /Template.*(NotFound|Language|Inactive|NotApproved|Unavailable)/i.test(name)) {
    return 'Bird cannot find that template (or its language), or it is not approved yet. Check the template name (slug) and language in Bird → WhatsApp → Templates.';
  }
  const where = code ? ` (${code}${name ? ' ' + name : ''})` : '';
  return msg ? `Bird said: ${msg}${where}` : `Bird returned an error (HTTP ${status}).`;
}

function explainBirdFailure(lastError: any): string {
  const code = String(lastError?.code || ''); const desc = String(lastError?.description || '').slice(0, 200);
  switch (code) {
    case 'insufficient_balance': return 'Your Bird wallet has no balance, so nothing was sent. Top it up in Bird → Billing; the portal will retry.';
    case 'price_not_found': return 'Bird has no price set for this country, so it did not send. Check Bird → Billing → Pricing.';
    case 'undeliverable': return 'WhatsApp could not deliver to this number. Check that it is correct and has WhatsApp.';
    case 'service_window_expired': return 'WhatsApp only allows free text within 24 hours of that person writing to your Bird number. Use template mode.';
    case 'rate_limited': return 'WhatsApp throttled the send. It will retry later.';
    case 'recipient_suppressed': return 'This number is on Bird’s opt-out list, so Bird will not message it. Remove it under Bird → WhatsApp → Suppressions.';
    case 'internal_error': return 'Bird could not send this (its sender credential is missing or expired). Check the number under Bird → WhatsApp → Numbers.';
    default: return desc ? `Bird reported: ${desc}` : 'Bird reported that the message failed.';
  }
}

async function sendBird(cfg: ReportConfig, r: Recipient, report: DailyReport): Promise<SendResult> {
  const base = { name: r.name, phone: r.phone };
  const root = birdBase(cfg.birdApiKey);
  const headers = { Authorization: `Bearer ${cfg.birdApiKey}`, 'Content-Type': 'application/json' };
  const from = '+' + String(cfg.birdFrom).replace(/\D/g, '');
  const payload = cfg.mode === 'text'
    ? { to: '+' + r.phone, from, text: { body: report.text.slice(0, 4000) } }
    : {
        to: '+' + r.phone, from,
        template: {
          slug: cfg.templateName, language: cfg.language || 'en',
          components: [{ type: 'body', parameters: templateVars(report, cfg.templateStyle).map(text => ({ type: 'text', text })) }],
        },
      };
  // One key per logical send: a retry of a lost answer replays the first result instead of sending twice.
  const idem = crypto.randomUUID();
  const retryMs = Number(process.env.BIRD_RETRY_MS ?? 1500);
  let accepted: any = null;
  let lastErr = '';
  for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
    if (attempt) await sleep(retryMs);
    try {
      const res = await http(`${root}/v1/whatsapp/messages`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': idem }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.id) { accepted = json; break; }
      lastErr = explainBirdHttp(res.status, json);
      if (res.status !== 429 && res.status < 500) return { ...base, ok: false, error: lastErr }; // retrying cannot help
    } catch (e) {
      lastErr = (e as Error).name === 'AbortError' ? 'Bird did not answer in time.' : `Could not reach Bird (${(e as Error).message}).`;
    }
  }
  if (!accepted) return { ...base, ok: false, error: lastErr };

  // Look the message up for a few seconds to catch an early "rejected" or "failed".
  const polls = Number(process.env.BIRD_POLLS ?? 4);
  const pollMs = Number(process.env.BIRD_POLL_MS ?? 1500);
  let status = String(accepted.status || 'accepted');
  if (status === 'failed' || status === 'rejected') return { ...base, ok: false, id: accepted.id, error: explainBirdFailure(accepted.last_error) };
  for (let i = 0; i < polls && !['delivered', 'failed', 'rejected'].includes(status); i++) {
    await sleep(pollMs);
    try {
      const res = await http(`${root}/v1/whatsapp/messages/${encodeURIComponent(accepted.id)}`, { method: 'GET', headers, timeoutMs: 8000 });
      const m = await res.json().catch(() => ({}));
      if (!res.ok || !m?.status) continue;
      status = String(m.status);
      if (status === 'failed' || status === 'rejected') return { ...base, ok: false, id: accepted.id, error: explainBirdFailure(m.last_error) };
      if (m.read_at) break;
    } catch { /* the message was accepted; a failed lookup is not a failed send */ }
  }
  return { ...base, ok: true, id: accepted.id };
}

export async function sendReport(cfg: ReportConfig, report: DailyReport, to: Recipient[]): Promise<SendResult[]> {
  const out: SendResult[] = [];
  for (const r of to) {
    out.push(cfg.provider === 'callmebot' ? await sendCallMeBot(r, report) : cfg.provider === 'bird' ? await sendBird(cfg, r, report) : await sendCloud(cfg, r, report));
  }
  return out;
}
