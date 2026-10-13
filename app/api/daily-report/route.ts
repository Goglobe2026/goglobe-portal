import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { readConfig, writeConfig, isReady, publicConfig, normalizeWhatsApp, type Recipient, type ReportConfig } from '@/lib/reportConfig';
import { TEMPLATE_BODIES } from '@/lib/dailyReport';
import { previewReport } from '@/lib/reportRunner';
import { pktNow, coverDate, dueNow } from '@/lib/reportSchedule';

export const dynamic = 'force-dynamic';

// The report carries the firm's money and the WhatsApp access token, so every
// part of this page is for the Head Manager only.
function headManager(req: NextRequest) {
  const s = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  return s && s.type === 'ceo' ? s : null;
}
const deny = () => NextResponse.json({ error: 'Only the Head Manager can open the daily report.' }, { status: 403 });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

function state(cfg: ReportConfig) {
  const now = pktNow(Date.now());
  const ready = isReady(cfg);
  const due = dueNow(cfg, Date.now());
  return {
    config: publicConfig(cfg), ready: ready.ready, missing: ready.missing,
    templateBodies: TEMPLATE_BODIES,
    serverNow: { date: now.date, time: now.time },
    coverDate: coverDate(cfg, now.date),
    sentToday: cfg.lastSentDate === now.date,
    nextNote: due.due ? 'Sending now' : due.reason,
  };
}

export async function GET(req: NextRequest) {
  if (!headManager(req)) return deny();
  const cfg = readConfig();
  const asked = req.nextUrl.searchParams.get('date') || '';
  const st = state(cfg);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : st.coverDate;
  return NextResponse.json({ ...st, report: previewReport(date) });
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function PUT(req: NextRequest) {
  if (!headManager(req)) return deny();
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return bad('Nothing to save.');
  const cfg = readConfig();

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.sendTime))) return bad('Send time must look like 20:00.');
  if (!['today', 'yesterday'].includes(b.covers)) return bad('Choose whether the report covers today or yesterday.');
  if (!['cloud', 'callmebot'].includes(b.provider)) return bad('Choose how the report is sent.');
  if (!['template', 'text'].includes(b.mode)) return bad('Choose template or text mode.');
  if (!['detailed', 'compact'].includes(b.templateStyle)) return bad('Choose the template style.');
  const language = str(b.language, 10) || 'en';
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language)) return bad('Template language looks like "en" or "en_GB".');
  const templateName = str(b.templateName, 100);
  if (templateName && !/^[a-z0-9_]+$/.test(templateName)) return bad('Template names use only small letters, numbers and underscores.');
  const phoneNumberId = str(b.phoneNumberId, 40);
  if (phoneNumberId && !/^\d{5,30}$/.test(phoneNumberId)) return bad('The phone number ID is digits only — copy it from Meta → WhatsApp → API Setup.');

  const incoming = Array.isArray(b.recipients) ? b.recipients : [];
  if (incoming.length > 5) return bad('You can send the report to at most 5 numbers.');
  const recipients: Recipient[] = [];
  for (const r of incoming) {
    const phone = normalizeWhatsApp(str(r?.phone, 30));
    if (!phone) return bad(`"${str(r?.phone, 30)}" is not a valid WhatsApp number. Write it like 0300 1234567 or +92 300 1234567.`);
    if (recipients.some(x => x.phone === phone)) continue;
    const old = cfg.recipients.find(x => x.phone === phone);
    const key = str(r?.key, 60) || old?.key || '';
    recipients.push({ name: str(r?.name, 60) || 'Head Manager', phone, ...(key ? { key } : {}) });
  }

  // A blank token means "keep what is saved"; clearToken removes it.
  let token = cfg.token;
  if (b.clearToken === true) token = '';
  else if (typeof b.token === 'string' && b.token.trim()) {
    token = b.token.trim();
    if (/\s/.test(token) || token.length < 20 || token.length > 1000) return bad('That access token does not look right — paste it exactly as Meta shows it, with no spaces.');
  }

  const next: ReportConfig = {
    ...cfg, enabled: b.enabled === true, sendTime: b.sendTime, covers: b.covers, provider: b.provider, mode: b.mode,
    templateName, templateStyle: b.templateStyle, language, phoneNumberId, token, recipients,
  };
  if (next.enabled) {
    const r = isReady(next);
    if (!r.ready) return bad(`To switch automatic sending on you still need ${r.missing.join(', ')}.`);
  }
  writeConfig(next);
  return NextResponse.json({ ok: true, ...state(readConfig()) });
}
