import type { ReportConfig, Recipient } from './reportConfig';
import { templateVars, type DailyReport } from './dailyReport';

export interface SendResult { name: string; phone: string; ok: boolean; error?: string; id?: string }

const API_BASE = () => process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0';
const CALLMEBOT_BASE = () => process.env.CALLMEBOT_BASE || 'https://api.callmebot.com';

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

export async function sendReport(cfg: ReportConfig, report: DailyReport, to: Recipient[]): Promise<SendResult[]> {
  const out: SendResult[] = [];
  for (const r of to) out.push(cfg.provider === 'callmebot' ? await sendCallMeBot(r, report) : await sendCloud(cfg, r, report));
  return out;
}
