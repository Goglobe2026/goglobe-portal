import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import {
  readMetaConfig, writeMetaConfig, publicMetaConfig, readMetaData, clearMetaData, parseAccountId, looksLikeToken, testConnection, DEFAULT_META, WINDOWS, type MetaWindow,
} from '@/lib/metaAds';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const deny = () => NextResponse.json({ error: 'Only the Head Manager or an admin can open Ads Manager.' }, { status: 403 });

// What the screen needs: the connection (token hidden), the account, and the last figures read for a window.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return deny();
  const w = (new URL(req.url).searchParams.get('window') || 'last_30d') as MetaWindow;
  const cfg = readMetaConfig();
  const data = readMetaData();
  return NextResponse.json({ config: publicMetaConfig(cfg), account: data.account || null, snapshot: WINDOWS.includes(w) ? data.snapshots[w] || null : null }, { headers: NO_STORE });
}

// Saves the connection. A new account ID or token is tested straight away, so a wrong paste is caught here.
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return deny();
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  const cfg = readMetaConfig();

  if (b.disconnect === true) {
    writeMetaConfig({ ...DEFAULT_META, usdRate: cfg.usdRate, taxPct: cfg.taxPct });
    clearMetaData();
    return NextResponse.json({ ok: true, config: publicMetaConfig(readMetaConfig()) });
  }
  let changed = false;
  if (b.accountId !== undefined) {
    const id = parseAccountId(String(b.accountId));
    if (!id) return NextResponse.json({ error: 'That does not look like an ad account ID. It is a number of 10–16 digits — in Ads Manager it is shown next to the account name, and in the address as act=…' }, { status: 400 });
    if (id !== cfg.accountId) changed = true;
    cfg.accountId = id;
  }
  if (typeof b.token === 'string' && b.token.trim()) {
    if (!looksLikeToken(b.token)) return NextResponse.json({ error: 'That does not look like an access token. It is one long line of letters and numbers with no spaces.' }, { status: 400 });
    cfg.token = b.token.trim(); changed = true;
  }
  if (b.usdRate !== undefined) {
    const r = Number(b.usdRate);
    if (!(r >= 0 && r <= 10000)) return NextResponse.json({ error: 'The dollar rate must be a number of rupees, for example 281.' }, { status: 400 });
    cfg.usdRate = r;
  }
  if (b.taxPct !== undefined) {
    const t = Number(b.taxPct);
    if (!(t >= 0 && t <= 100)) return NextResponse.json({ error: 'The tax must be between 0 and 100 per cent.' }, { status: 400 });
    cfg.taxPct = t;
  }
  if (typeof b.auto === 'boolean') cfg.auto = b.auto;
  if (b.everyMinutes !== undefined) {
    const m = Number(b.everyMinutes);
    if (!(m >= 15 && m <= 1440)) return NextResponse.json({ error: 'Choose between every 15 minutes and once a day.' }, { status: 400 });
    cfg.everyMinutes = Math.round(m);
  }
  if (changed) { cfg.lastError = ''; cfg.lastOkAt = ''; }
  writeMetaConfig(cfg);

  let test: unknown = undefined;
  if (changed && cfg.accountId && cfg.token) {
    const t = await testConnection(readMetaConfig());
    test = t;
    if (!t.ok) { const c = readMetaConfig(); c.lastError = t.error; writeMetaConfig(c); }
    else { const c = readMetaConfig(); c.lastOkAt = new Date().toISOString(); writeMetaConfig(c); }
  }
  return NextResponse.json({ ok: true, config: publicMetaConfig(readMetaConfig()), test });
}
