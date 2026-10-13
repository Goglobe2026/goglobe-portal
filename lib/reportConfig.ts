import crypto from 'crypto';
import { readJsonFile, writeJsonFile } from './store';

export type Provider = 'cloud' | 'callmebot';
export interface Recipient { name: string; phone: string; key?: string } // phone: digits with country code; key: CallMeBot key
export interface HistoryItem {
  at: string; source: 'schedule' | 'manual' | 'cron'; date: string;
  results: { name: string; last4: string; ok: boolean; error?: string }[];
}
export interface ReportConfig {
  enabled: boolean;
  sendTime: string;                 // HH:MM, Pakistan time
  covers: 'today' | 'yesterday';
  recipients: Recipient[];
  provider: Provider;
  // WhatsApp Business Cloud API (Meta)
  phoneNumberId: string;
  token: string;
  mode: 'template' | 'text';
  templateName: string;
  templateStyle: 'detailed' | 'compact';
  language: string;
  // bookkeeping
  cronKey: string;
  lastSentDate: string;             // the day the automatic send last fully succeeded
  delivered: { date: string; phones: string[] };
  attempts: { date: string; count: number; lastAt: number };
  history: HistoryItem[];
}

const FILE = 'reportconfig';

export const DEFAULT_CONFIG: ReportConfig = {
  enabled: false, sendTime: '20:00', covers: 'today', recipients: [], provider: 'cloud',
  phoneNumberId: '', token: '', mode: 'template', templateName: 'goglobe_daily_report', templateStyle: 'detailed', language: 'en',
  cronKey: '', lastSentDate: '', delivered: { date: '', phones: [] }, attempts: { date: '', count: 0, lastAt: 0 }, history: [],
};

export function readConfig(): ReportConfig {
  const c = { ...DEFAULT_CONFIG, ...readJsonFile<Partial<ReportConfig>>(FILE, {}) };
  // Hosting-provider environment variables win, so the token can live there instead of on disk.
  if (process.env.WHATSAPP_TOKEN) c.token = process.env.WHATSAPP_TOKEN;
  if (process.env.WHATSAPP_PHONE_NUMBER_ID) c.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!c.cronKey) { c.cronKey = crypto.randomBytes(18).toString('hex'); writeConfig(c); } // keep it, so the backup link stays the same
  return c;
}

export function writeConfig(c: ReportConfig) {
  const toSave = { ...c };
  if (process.env.WHATSAPP_TOKEN && toSave.token === process.env.WHATSAPP_TOKEN) toSave.token = '';
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && toSave.phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) toSave.phoneNumberId = '';
  writeJsonFile(FILE, toSave);
}

// Digits with country code. Pakistani numbers written as 03xx… become 923xx….
export function normalizeWhatsApp(raw: string): string {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '92' + d.slice(1);
  if (d.startsWith('920')) d = '92' + d.slice(3);
  return d.length >= 10 && d.length <= 15 ? d : '';
}

export function isReady(c: ReportConfig): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!c.recipients.length) missing.push('at least one WhatsApp number');
  if (c.provider === 'cloud') {
    if (!c.phoneNumberId) missing.push('the WhatsApp phone number ID');
    if (!c.token) missing.push('the access token');
    if (c.mode === 'template' && !c.templateName) missing.push('the template name');
  } else if (c.recipients.some(r => !r.key)) {
    missing.push('a CallMeBot key for every number');
  }
  return { ready: missing.length === 0, missing };
}

// What the browser may see: never the token or the keys themselves.
export function publicConfig(c: ReportConfig) {
  return {
    enabled: c.enabled, sendTime: c.sendTime, covers: c.covers, provider: c.provider, mode: c.mode,
    templateName: c.templateName, templateStyle: c.templateStyle, language: c.language,
    phoneNumberId: c.phoneNumberId,
    tokenSet: !!c.token, tokenHint: c.token ? `…${c.token.slice(-4)}` : '', tokenFromEnv: !!process.env.WHATSAPP_TOKEN,
    recipients: c.recipients.map(r => ({ name: r.name, phone: r.phone, keySet: !!r.key })),
    lastSentDate: c.lastSentDate, history: c.history.slice(0, 20), cronKey: c.cronKey,
  };
}
