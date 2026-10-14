'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { useToast } from '@/components/ui/Toast';
import { EmptyState, SectionHead } from '@/components/ui/Primitives';
import { fmtDate } from '@/lib/constants';
import { LOGO_ICON } from '@/lib/logo';
import type { publicConfig } from '@/lib/reportConfig';
import { templateVars, type DailyReport as DailyReportData } from '@/lib/dailyReport';

type PubCfg = ReturnType<typeof publicConfig>;
type Style = 'detailed' | 'compact';
interface Resp {
  report: DailyReportData; config: PubCfg; ready: boolean; missing: string[];
  templateBodies: Record<Style, string>; serverNow: { date: string; time: string };
  coverDate: string; sentToday: boolean; nextNote: string;
}
interface DraftRecipient { name: string; phone: string; key: string; keySet: boolean }
interface Draft {
  enabled: boolean; sendTime: string; covers: 'today' | 'yesterday'; provider: 'cloud' | 'callmebot' | 'bird'; mode: 'template' | 'text';
  templateName: string; templateStyle: Style; language: string; phoneNumberId: string; token: string; clearToken: boolean;
  birdFrom: string; birdApiKey: string; clearBirdKey: boolean;
  recipients: DraftRecipient[];
}
interface SendOutcome { ok: boolean; sent: number; failed: number; date: string; results: { name: string; last4: string; ok: boolean; error?: string }[]; error?: string }

const fmt12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const shiftISO = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const fillTemplate = (body: string, vars: string[]) => body.replace(/\{\{(\d+)\}\}/g, (_, n) => vars[Number(n) - 1] ?? '');
const SOURCE_LABEL: Record<string, string> = { schedule: 'Automatic', cron: 'Backup link', manual: 'Send now' };

function draftFrom(c: PubCfg): Draft {
  return {
    enabled: c.enabled, sendTime: c.sendTime, covers: c.covers, provider: c.provider, mode: c.mode,
    templateName: c.templateName, templateStyle: c.templateStyle, language: c.language, phoneNumberId: c.phoneNumberId,
    token: '', clearToken: false,
    birdFrom: c.birdFrom ? '+' + c.birdFrom : '', birdApiKey: '', clearBirdKey: false,
    recipients: c.recipients.map(r => ({ name: r.name, phone: '+' + r.phone, key: '', keySet: r.keySet })),
  };
}

export function DailyReport() {
  const { session } = useAppData();
  if (session?.type !== 'ceo') {
    return <EmptyState title="The daily report is for the Head Manager" body="It carries the firm’s money and the WhatsApp connection, so only the Head Manager can open it." />;
  }
  return <DailyReportInner />;
}

function DailyReportInner() {
  const toast = useToast();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [tab, setTab] = useState<'report' | 'settings' | 'setup' | 'history'>('report');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const [view, setView] = useState<'text' | 'template' | null>(null);

  const load = useCallback(async (d?: string, resetDraft = false) => {
    try {
      const res = await fetch('/api/daily-report' + (d ? `?date=${d}` : ''), { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Could not load the report.'); return; }
      setError('');
      setData(json as Resp);
      setDate(prev => d || prev || json.report.date);
      setDraft(prev => (prev && !resetDraft ? prev : draftFrom(json.config)));
    } catch { setError('Could not reach the server.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function pickDate(d: string) { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { setDate(d); setOutcome(null); load(d); } }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast('Could not copy — select the text and press Ctrl+C'); }
  }

  async function sendNow() {
    setSending(true); setOutcome(null);
    try {
      const res = await fetch('/api/daily-report/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setOutcome({ ok: false, sent: 0, failed: 0, date, results: [], error: json.error || 'Could not send.' });
      else { setOutcome(json); toast(json.ok ? `Report sent to ${json.sent} number${json.sent === 1 ? '' : 's'}` : 'The report did not reach everyone'); }
    } catch { setOutcome({ ok: false, sent: 0, failed: 0, date, results: [], error: 'Could not reach the server.' }); }
    setSending(false);
    load(date);
  }

  async function save() {
    if (!draft) return;
    setSaving(true); setSaveError('');
    try {
      const res = await fetch('/api/daily-report', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft, recipients: draft.recipients.filter(r => r.phone.trim()).map(r => ({ name: r.name, phone: r.phone, key: r.key })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveError(json.error || 'Could not save.'); toast('Not saved — see the message'); }
      else { setData(d => (d ? { ...d, ...json, report: d.report } : d)); setDraft(draftFrom(json.config)); toast('Saved'); load(date); }
    } catch { setSaveError('Could not reach the server.'); }
    setSaving(false);
  }

  if (error && !data) return <EmptyState title="Could not open the daily report" body={error} />;
  if (!data || !draft) return <div className="text-[var(--muted)]">Loading…</div>;

  const { report, config } = data;
  const firstPhone = config.recipients[0]?.phone || '';
  const lastAuto = config.history.find(h => h.source !== 'manual');
  const autoFailed = lastAuto && lastAuto.results.some(r => !r.ok) && lastAuto.date && !data.sentToday;
  const savedAsTemplate = config.provider !== 'callmebot' && config.mode === 'template';
  const shown = view ?? (savedAsTemplate ? 'template' : 'text');
  const bubbleText = shown === 'template' ? fillTemplate(data.templateBodies[config.templateStyle], templateVars(report, config.templateStyle)) : report.text;
  const upd = (p: Partial<Draft>) => setDraft(d => (d ? { ...d, ...p } : d));
  const updRec = (i: number, p: Partial<DraftRecipient>) => setDraft(d => (d ? { ...d, recipients: d.recipients.map((r, j) => (j === i ? { ...r, ...p } : r)) } : d));
  const backupUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/daily-report/cron?key=${config.cronKey}` : '';

  return (
    <div>
      {/* Status */}
      <div className="card flat flex items-center justify-between gap-4 flex-wrap" style={{ transform: 'none' }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: config.enabled && data.ready ? 'var(--green)' : 'var(--faint)', boxShadow: config.enabled && data.ready ? '0 0 0 4px var(--green-50)' : undefined }} />
          <div className="min-w-0">
            <div className="font-display font-semibold text-[15.5px]">
              {config.enabled && data.ready ? 'Automatic WhatsApp report is on' : config.enabled ? 'Automatic report is on, but setup is not finished' : 'Automatic WhatsApp report is off'}
            </div>
            <div className="text-[12.5px] text-[var(--muted)]">
              {config.enabled
                ? <>Every day at <b className="text-[var(--ink)]">{fmt12(config.sendTime)}</b> Pakistan time · covers {config.covers === 'today' ? 'the same day' : 'the day before'} · {config.recipients.length ? config.recipients.map(r => `${r.name} (…${r.phone.slice(-4)})`).join(', ') : 'no number added yet'}</>
                : 'Switch it on under Settings and it arrives on its own, every day.'}
            </div>
          </div>
        </div>
        <div className="text-right text-[12.5px] text-[var(--muted)]">
          Last automatic report<br /><b className="text-[var(--ink)] text-[13.5px]">{config.lastSentDate ? fmtDate(config.lastSentDate) : 'Not sent yet'}</b>
        </div>
      </div>
      {!data.ready && (
        <Alert tone="gold" title="Setup is not finished">
          You still need {data.missing.join(', ')}. <button className="underline font-medium" onClick={() => setTab('setup')}>Open the setup guide</button> · <button className="underline font-medium" onClick={() => setTab('settings')}>Open settings</button>
        </Alert>
      )}
      {autoFailed && (
        <Alert tone="red" title="The last automatic send did not reach everyone">
          {lastAuto!.results.filter(r => !r.ok).map(r => `${r.name} (…${r.last4}): ${r.error}`).join(' · ')} — it tries again every 10 minutes, up to 3 times a day.
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mt-5 mb-5 flex-wrap">
        {([['report', 'Report'], ['settings', 'Settings'], ['setup', 'Setup guide'], ['history', 'History']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="btn" style={tab === id ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : undefined}>{label}</button>
        ))}
      </div>

      {tab === 'report' && (
        <div>
          <div className="card flex items-center gap-2 flex-wrap" style={{ transform: 'none' }}>
            <button className="btn btn-sm" aria-label="Previous day" onClick={() => pickDate(shiftISO(date, -1))}>◀</button>
            <input type="date" value={date} onChange={e => pickDate(e.target.value)} style={{ width: 160 }} aria-label="Report date" />
            <button className="btn btn-sm" aria-label="Next day" onClick={() => pickDate(shiftISO(date, 1))}>▶</button>
            <button className="btn btn-sm" onClick={() => pickDate(data.serverNow.date)}>Today</button>
            <div className="flex-1" />
            <button className="btn btn-sm" onClick={() => copy(report.text, 'Report')}>Copy text</button>
            <a className="btn btn-sm" style={{ textDecoration: 'none' }} target="_blank" rel="noreferrer"
              href={`https://wa.me/${firstPhone}?text=${encodeURIComponent(report.text)}`}>Open in WhatsApp</a>
            <button className="btn btn-primary" disabled={sending || !data.ready} title={data.ready ? '' : 'Finish the setup first'} onClick={sendNow}
              style={sending || !data.ready ? { opacity: .55, cursor: 'not-allowed' } : undefined}>
              {sending ? 'Sending…' : `Send now to ${config.recipients.length || 'my'} number${config.recipients.length === 1 ? '' : 's'}`}
            </button>
          </div>

          {outcome && (
            <Alert tone={outcome.ok ? 'green' : 'red'} title={outcome.error ? 'Not sent' : outcome.ok ? `Sent for ${fmtDate(outcome.date)}` : 'Some messages did not go through'}>
              {outcome.error || outcome.results.map(r => `${r.ok ? '✓' : '✗'} ${r.name} (…${r.last4})${r.error ? ` — ${r.error}` : ''}`).join('   ')}
            </Alert>
          )}

          <div className="flex flex-wrap gap-5 mt-5 items-start">
            <div style={{ flex: '0 1 400px', minWidth: 290 }}>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--line)', boxShadow: '0 8px 26px rgba(11,110,79,.1)' }}>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ background: 'linear-gradient(135deg,#0B6E4F,#14A876)', color: '#fff' }}>
                  <img src={LOGO_ICON} alt="" className="w-8 h-8 rounded-full bg-white object-cover" />
                  <div>
                    <div className="text-[14px] font-semibold leading-tight">GoGlobe Ops</div>
                    <div className="text-[11px] opacity-80">Business account · daily report</div>
                  </div>
                </div>
                <div className="p-4" style={{ background: '#EFE8DF', minHeight: 360 }}>
                  <div className="text-center mb-3"><span className="text-[11px] px-2.5 py-1 rounded-md" style={{ background: 'rgba(255,255,255,.75)', color: '#667781' }}>{report.dateLabel}</span></div>
                  <div className="px-3 py-2.5 text-[13.5px] leading-[1.45] max-w-[96%]" style={{ background: '#fff', color: '#111B21', borderRadius: '4px 12px 12px 12px', boxShadow: '0 1px 1.5px rgba(11,20,26,.13)', wordBreak: 'break-word' }}>
                    <WaText text={bubbleText} />
                    <div className="text-right text-[10.5px] mt-1" style={{ color: '#667781' }}>{fmt12(config.sendTime)}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-[12px] text-[var(--muted)]">
                <span>Show as:</span>
                <button className="btn btn-sm" onClick={() => setView('text')} style={shown === 'text' ? { borderColor: 'var(--navy)', color: 'var(--navy)', fontWeight: 600 } : undefined}>Full text</button>
                <button className="btn btn-sm" onClick={() => setView('template')} style={shown === 'template' ? { borderColor: 'var(--navy)', color: 'var(--navy)', fontWeight: 600 } : undefined}>Approved template</button>
              </div>
              <div className="text-[11.5px] text-[var(--muted)] mt-1.5 leading-relaxed">
                {savedAsTemplate
                  ? 'Your settings send the approved template: WhatsApp shows its fixed wording with today’s figures filled in.'
                  : 'Your settings send the full text exactly as shown.'}
              </div>
            </div>

            <div style={{ flex: '1 1 440px', minWidth: 0 }}>
              <div className="flex items-baseline justify-between mb-2.5">
                <h2 className="font-display text-base font-semibold m-0">{report.dateLabel}</h2>
                <span className="text-[12px]" style={{ color: report.urgent ? 'var(--red)' : 'var(--muted)', fontWeight: report.urgent ? 600 : 400 }}>
                  {report.urgent ? `${report.urgent} thing${report.urgent === 1 ? '' : 's'} need${report.urgent === 1 ? 's' : ''} your attention` : 'Nothing urgent'}
                </span>
              </div>
              <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))' }}>
                {report.sections.map(s => (
                  <div key={s.key} className="card" style={{ transform: 'none', borderColor: s.key === 'attention' && report.urgent ? 'var(--red)' : undefined, background: s.key === 'attention' && report.urgent ? 'var(--red-50)' : undefined }}>
                    <div className="text-[11.5px] uppercase tracking-wide font-semibold mb-2" style={{ color: s.key === 'attention' && report.urgent ? 'var(--red)' : 'var(--muted)' }}>{s.heading}</div>
                    <ul className="m-0 pl-4 text-[13px] leading-relaxed">
                      {s.lines.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="grid gap-5" style={{ maxWidth: 820 }}>
          {saveError && <Alert tone="red" title="Not saved">{saveError}</Alert>}

          <Panel title="Automatic sending" hint="The report goes out by itself every day — nobody has to remember.">
            <label className="!flex items-center gap-2.5 cursor-pointer mb-4">
              <input type="checkbox" checked={draft.enabled} onChange={e => upd({ enabled: e.target.checked })} />
              <span className="text-[13.5px] text-[var(--ink)] font-medium">Send the daily report automatically</span>
            </label>
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label>Send at (Pakistan time)</label>
                <input type="time" value={draft.sendTime} onChange={e => upd({ sendTime: e.target.value })} />
              </div>
              <div>
                <label>The report covers</label>
                <select value={draft.covers} onChange={e => upd({ covers: e.target.value as Draft['covers'] })}>
                  <option value="today">The same day it is sent (evening report)</option>
                  <option value="yesterday">The day before (morning report)</option>
                </select>
              </div>
            </div>
            <div className="text-[12px] text-[var(--muted)] mt-2.5">If the server was off at that time, the report is sent as soon as it is back — the same day.</div>
          </Panel>

          <Panel title="Who receives it" hint="Up to 5 WhatsApp numbers. Write them the normal way — 0300 1234567 or +92 300 1234567.">
            {draft.recipients.map((r, i) => (
              <div key={i} className="grid gap-2.5 mb-2.5 items-end" style={{ gridTemplateColumns: draft.provider === 'callmebot' ? '1fr 1.2fr 1fr auto' : '1fr 1.4fr auto' }}>
                <div>{i === 0 && <label>Name</label>}<input value={r.name} onChange={e => updRec(i, { name: e.target.value })} placeholder="Head Manager" /></div>
                <div>{i === 0 && <label>WhatsApp number</label>}<input value={r.phone} inputMode="tel" onChange={e => updRec(i, { phone: e.target.value })} placeholder="+92 300 1234567" /></div>
                {draft.provider === 'callmebot' && (
                  <div>{i === 0 && <label>CallMeBot key</label>}<input value={r.key} onChange={e => updRec(i, { key: e.target.value })} placeholder={r.keySet ? 'Saved — blank keeps it' : 'Key from CallMeBot (see Setup guide)'} /></div>
                )}
                <button className="btn btn-sm btn-danger" aria-label="Remove number" onClick={() => upd({ recipients: draft.recipients.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            {draft.recipients.length < 5 && (
              <button className="btn btn-sm" onClick={() => upd({ recipients: [...draft.recipients, { name: draft.recipients.length ? '' : 'Head Manager', phone: '', key: '', keySet: false }] })}>+ Add a number</button>
            )}
          </Panel>

          <Panel title="How it is sent" hint="CallMeBot costs nothing. Bird or Meta’s own connection are the dependable paid choices once you rely on the report.">
            <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))' }}>
              {([
                ['callmebot', 'CallMeBot (free, simple)', 'Free. Reports arrive in WhatsApp from CallMeBot’s number, not from yours. It is a third-party service, so its server sees the report text.'],
                ['bird', 'Bird (WhatsApp Business)', 'An official WhatsApp partner. Simplest route to the real WhatsApp Business connection; pay-as-you-go.'],
                ['cloud', 'Meta direct (Cloud API)', 'Connect to Meta yourself. No middleman, but a longer one-time setup.'],
              ] as const).map(([id, t, d]) => (
                <button key={id} type="button" onClick={() => upd({ provider: id })} className="text-left rounded-xl p-3.5"
                  style={{ border: `1.5px solid ${draft.provider === id ? 'var(--navy)' : 'var(--line)'}`, background: draft.provider === id ? 'var(--green-50)' : '#fff', cursor: 'pointer' }}>
                  <div className="text-[13.5px] font-semibold">{t}</div>
                  <div className="text-[12px] text-[var(--muted)] mt-0.5 leading-relaxed">{d}</div>
                </button>
              ))}
            </div>

            {draft.provider !== 'callmebot' && (
              <div className="grid gap-4">
                {draft.provider === 'cloud' ? (
                  <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <label>Phone number ID</label>
                      <input value={draft.phoneNumberId} onChange={e => upd({ phoneNumberId: e.target.value })} placeholder="e.g. 123456789012345" inputMode="numeric" />
                    </div>
                    <div>
                      <label>Permanent access token</label>
                      <input type="password" autoComplete="new-password" value={draft.token} disabled={config.tokenFromEnv}
                        onChange={e => upd({ token: e.target.value, clearToken: false })}
                        placeholder={config.tokenFromEnv ? 'Set in the hosting settings' : config.tokenSet ? `Saved (${config.tokenHint}) — leave blank to keep` : 'Paste the token from Meta'} />
                      {config.tokenSet && !config.tokenFromEnv && !draft.clearToken && (
                        <button type="button" className="text-[11.5px] underline text-[var(--red)] mt-1" onClick={() => upd({ clearToken: true, token: '' })}>Remove the saved token</button>
                      )}
                      {draft.clearToken && <div className="text-[11.5px] text-[var(--red)] mt-1">The token will be removed when you save.</div>}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <label>Sending number (the one connected in Bird)</label>
                      <input value={draft.birdFrom} inputMode="tel" onChange={e => upd({ birdFrom: e.target.value })} placeholder="e.g. +92 333 1234567" />
                    </div>
                    <div>
                      <label>Bird API key</label>
                      <input type="password" autoComplete="new-password" value={draft.birdApiKey} disabled={config.birdKeyFromEnv}
                        onChange={e => upd({ birdApiKey: e.target.value, clearBirdKey: false })}
                        placeholder={config.birdKeyFromEnv ? 'Set in the hosting settings' : config.birdKeySet ? `Saved (${config.birdKeyHint}) — leave blank to keep` : 'Paste the key from Bird'} />
                      {config.birdKeySet && !config.birdKeyFromEnv && !draft.clearBirdKey && (
                        <button type="button" className="text-[11.5px] underline text-[var(--red)] mt-1" onClick={() => upd({ clearBirdKey: true, birdApiKey: '' })}>Remove the saved key</button>
                      )}
                      {draft.clearBirdKey && <div className="text-[11.5px] text-[var(--red)] mt-1">The key will be removed when you save.</div>}
                    </div>
                  </div>
                )}
                <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <label>Message type</label>
                    <select value={draft.mode} onChange={e => upd({ mode: e.target.value as Draft['mode'] })}>
                      <option value="template">Template — works at any time (recommended)</option>
                      <option value="text">Plain text — only within 24 hours of you messaging the number</option>
                    </select>
                  </div>
                  <div>
                    <label>Template style</label>
                    <select value={draft.templateStyle} disabled={draft.mode !== 'template'} onChange={e => upd({ templateStyle: e.target.value as Style })}>
                      <option value="detailed">Detailed — one block per area</option>
                      <option value="compact">Compact — a single paragraph</option>
                    </select>
                  </div>
                </div>
                {draft.mode === 'template' && (
                  <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
                    <div><label>{draft.provider === 'bird' ? 'Template name / slug (exactly as in Bird)' : 'Template name (exactly as in WhatsApp Manager)'}</label><input value={draft.templateName} onChange={e => upd({ templateName: e.target.value.toLowerCase() })} placeholder="goglobe_daily_report" /></div>
                    <div><label>Template language</label><input value={draft.language} onChange={e => upd({ language: e.target.value })} placeholder="en" /></div>
                  </div>
                )}
                <div className="text-[12px] text-[var(--muted)] leading-relaxed">
                  {draft.provider === 'bird'
                    ? <>The key can also live in your hosting settings as <span className="font-mono-ui">BIRD_API_KEY</span> — then it never sits in the portal’s data at all. Once saved, the key is never shown again, not even to you.</>
                    : <>The token can also live in your hosting settings as <span className="font-mono-ui">WHATSAPP_TOKEN</span> and <span className="font-mono-ui">WHATSAPP_PHONE_NUMBER_ID</span> — then it never sits in the portal’s data at all. Once saved, the token is never shown again, not even to you.</>}
                </div>
              </div>
            )}
            {draft.provider === 'callmebot' && (
              <div className="text-[12.5px] text-[var(--muted)] leading-relaxed">
                Each person who receives the report needs their own CallMeBot key — the key comes in a WhatsApp reply from CallMeBot after that person activates their own number. Type it next to the number above. The report is sent as plain text (shortened to about 1,800 characters).
                <div className="mt-2"><button type="button" className="btn btn-sm" data-testid="open-callmebot-steps" onClick={() => setTab('setup')}>Where do I get the key? — open the step-by-step guide</button></div>
              </div>
            )}
          </Panel>

          <Panel title="Backup start link" hint="Only needed if your hosting puts the portal to sleep. A free website such as cron-job.org can open this link every 5 minutes; it does nothing unless the report is due.">
            <div className="flex gap-2">
              <input readOnly value={backupUrl} onFocus={e => e.currentTarget.select()} className="font-mono-ui" style={{ fontSize: 12 }} />
              <button className="btn btn-sm flex-none" onClick={() => copy(backupUrl, 'Link')}>Copy</button>
            </div>
            <div className="text-[11.5px] text-[var(--muted)] mt-1.5">Keep this link private — anyone who has it can trigger a send that is already due.</div>
          </Panel>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={save} disabled={saving} style={saving ? { opacity: .6 } : undefined}>{saving ? 'Saving…' : 'Save settings'}</button>
            <button className="btn" onClick={() => { setDraft(draftFrom(config)); setSaveError(''); }}>Undo changes</button>
          </div>
        </div>
      )}

      {tab === 'setup' && (
        <div className="grid gap-5" style={{ maxWidth: 820 }}>
          <Panel title="Free option — CallMeBot (start here)" hint="No account, no card, no waiting for approval. It takes about five minutes, and the key is only ever created by CallMeBot's reply on your own phone.">
            <ol className="m-0 pl-5 text-[13.5px] leading-[1.7] grid gap-1.5" data-testid="callmebot-steps">
              <li>Use the <b>phone that will receive the report</b> — the same number you type under <b>Who receives it</b> in Settings (for example +92 317 9911228). The WhatsApp Business app works too.</li>
              <li>On that phone, open <b>callmebot.com</b> in the browser and go to its <b>WhatsApp API</b> page. It shows <b>CallMeBot&apos;s own WhatsApp number</b> (it changes from time to time, so copy it from the page, not from memory). Save that number in your contacts as <b>CallMeBot</b>.</li>
              <li>In WhatsApp, send CallMeBot the <b>activation sentence shown on that page</b> (it says that you allow CallMeBot to send you messages). Send it exactly as written.</li>
              <li>Wait one or two minutes. CallMeBot answers in the same chat with <b>&ldquo;API Activated for your phone number. Your APIKEY is …&rdquo;</b>. The number after <b>APIKEY</b> is the key you are looking for. There is no other place to find it, and nobody here can create it for you.</li>
              <li>Come back here: <b>Settings → How it is sent → CallMeBot</b>. In the row for your number, paste that key into the <b>CallMeBot key</b> box, then press <b>Save settings</b>.</li>
              <li>Press <b>Send now</b> on the Report tab. The report arrives in your WhatsApp as a message from <b>CallMeBot</b>. If it does, switch on automatic sending and choose the time.</li>
            </ol>
            <div className="text-[12.5px] text-[var(--muted)] mt-3 leading-relaxed">
              Good to know: the report comes from CallMeBot&apos;s number, because a free service cannot send as your own number. Another person who should get the report does steps 1–4 on their own phone and gets their own key. If no reply arrives within five minutes, check that the saved contact is the number shown on the page and send the activation sentence again. CallMeBot is a free third-party service run by one person, so it can be slow or stop working; the paid options below are the dependable ones.
            </div>
          </Panel>

          <Panel title="Option 2 — Bird (official WhatsApp Business partner)" hint="Bird handles the connection to WhatsApp for you. You pay Bird per message; one report a day costs very little.">
            <ol className="m-0 pl-5 text-[13.5px] leading-[1.7] grid gap-1.5">
              <li>Sign in at <b>bird.com</b>. In the dashboard open <b>WhatsApp → Numbers</b> and connect a number. This opens a Facebook/Meta window — sign in with the Facebook account that owns the business and follow the steps. <b>The number you connect is the sender</b>, so it must be a different number from the one that receives the report, and it cannot also be in use on ordinary WhatsApp.</li>
              <li>Open <b>WhatsApp → Templates → Create template</b>: category <b>Utility</b>, name (slug) <span className="font-mono-ui">{draft.templateName || 'goglobe_daily_report'}</span>, language English, and paste the template text from the box below as the body. Use the sample values shown there when it asks for examples, then submit it. Approval usually takes minutes to a few hours.</li>
              <li>Open <b>Platform tools → API keys</b> and create a key. Give it only the <b>WhatsApp</b> permission, at <b>write</b> level. Copy it when it is shown — Bird shows it once.</li>
              <li>Top up the Bird wallet (<b>Billing</b>). Without balance Bird refuses to send, and the portal will say so.</li>
              <li>Come back to <b>Settings</b>, choose <b>Bird</b>, enter the sending number and paste the key, add the number that should receive the report, and press <b>Save</b>. Then press <b>Send now</b> on the Report tab to test, and switch on automatic sending.</li>
            </ol>
            <div className="text-[12px] text-[var(--muted)] mt-3 leading-relaxed">Bird’s dashboard wording can change slightly; the template and key are the two things that matter. The key can also be placed in your hosting settings as <span className="font-mono-ui">BIRD_API_KEY</span>.</div>
          </Panel>

          <Panel title="Option 3 — Meta direct (Cloud API)" hint="One-time setup of about 30 minutes. After that it runs on its own.">
            <ol className="m-0 pl-5 text-[13.5px] leading-[1.7] grid gap-1.5">
              <li>Go to <b>developers.facebook.com</b>, sign in with the Facebook account that owns your business, and create an app of type <b>Business</b>. Add the <b>WhatsApp</b> product to it.</li>
              <li>Open <b>WhatsApp → API Setup</b>. Copy the <b>Phone number ID</b> and paste it into Settings here. Meta gives a free test number to start with; later add your own business number there.</li>
              <li>The temporary token on that page expires in a day. For a permanent one: <b>Business Settings → Users → System users</b> → add a system user → assign your app and WhatsApp account → <b>Generate token</b> with the permissions <span className="font-mono-ui">whatsapp_business_messaging</span> and <span className="font-mono-ui">whatsapp_business_management</span>. Paste it into Settings here.</li>
              <li>In <b>WhatsApp Manager → Message templates → Create template</b>: category <b>Utility</b>, name <span className="font-mono-ui">{draft.templateName || 'goglobe_daily_report'}</span>, language English, and paste the text below as the body. Meta asks for sample values — use the ones listed below. Approval usually takes minutes to a few hours.</li>
              <li>While you use Meta’s test number, add your own number under <b>API Setup → To</b> so it is allowed to receive messages.</li>
              <li>Come back, add your number in Settings, press <b>Save</b>, then <b>Send now</b> on the Report tab to test. Then switch on automatic sending.</li>
            </ol>
            <div className="text-[12px] text-[var(--muted)] mt-3 leading-relaxed">Meta charges per business-started template message; one report a day is small, but check Meta’s current price list for your country.</div>
          </Panel>

          <Panel title="The template text" hint="Copy this into Bird (or Meta) exactly as it is. The numbered gaps are filled in by the portal.">
            <div className="flex gap-2 mb-2.5">
              {(['detailed', 'compact'] as const).map(s => (
                <button key={s} className="btn btn-sm" onClick={() => upd({ templateStyle: s })} style={draft.templateStyle === s ? { borderColor: 'var(--navy)', color: 'var(--navy)', fontWeight: 600 } : undefined}>{s === 'detailed' ? 'Detailed' : 'Compact'}</button>
              ))}
              <div className="flex-1" />
              <button className="btn btn-sm" onClick={() => copy(data.templateBodies[draft.templateStyle], 'Template text')}>Copy text</button>
            </div>
            <textarea readOnly rows={draft.templateStyle === 'detailed' ? 14 : 3} value={data.templateBodies[draft.templateStyle]} className="font-mono-ui" style={{ fontSize: 12.5, lineHeight: 1.55 }} />
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)] mt-4 mb-1.5">Sample values for the form</div>
            <div className="grid gap-1 text-[12.5px]">
              {templateVars(report, draft.templateStyle).map((v, i) => (
                <div key={i} className="flex gap-2"><span className="font-mono-ui flex-none text-[var(--navy)]">{`{{${i + 1}}}`}</span><span className="text-[var(--muted)] min-w-0" style={{ overflowWrap: 'anywhere' }}>{v.length > 160 ? v.slice(0, 160) + '…' : v}</span></div>
              ))}
            </div>
            <div className="text-[11.5px] text-[var(--muted)] mt-3">The style you tick here is the one used when you press Save in Settings — tick it, then save.</div>
          </Panel>

        </div>
      )}

      {tab === 'history' && (
        <div>
          <SectionHead title="Recent sends" count={`${config.history.length} recorded`} />
          {!config.history.length ? (
            <EmptyState title="Nothing sent yet" body="Every automatic and manual send is listed here with the result for each number." />
          ) : (
            <div className="card p-0 overflow-auto" style={{ transform: 'none' }}>
              <table>
                <thead><tr><th>When (Pakistan time)</th><th>How</th><th>Report for</th><th>Result</th></tr></thead>
                <tbody>
                  {config.history.map((h, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap">{stamp(h.at)}</td>
                      <td>{SOURCE_LABEL[h.source] || h.source}</td>
                      <td className="whitespace-nowrap">{fmtDate(h.date)}</td>
                      <td>
                        {h.results.map((r, j) => (
                          <div key={j} className="text-[12.5px]" style={{ color: r.ok ? 'var(--green)' : 'var(--red)' }}>
                            {r.ok ? '✓' : '✗'} {r.name}{r.last4 ? ` (…${r.last4})` : ''}{r.error ? <span className="text-[var(--muted)]"> — {r.error}</span> : ''}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <div key={i} style={{ minHeight: line ? undefined : 8 }}>
          {line.split(/(\*[^*]+\*)/g).map((p, j) => (/^\*[^*]+\*$/.test(p) ? <b key={j}>{p.slice(1, -1)}</b> : <span key={j}>{p}</span>))}
        </div>
      ))}
    </>
  );
}

function Alert({ tone, title, children }: { tone: 'gold' | 'red' | 'green'; title: string; children: React.ReactNode }) {
  const c = tone === 'red' ? ['var(--red)', 'var(--red-50)'] : tone === 'green' ? ['var(--green)', 'var(--green-50)'] : ['var(--gold)', 'var(--gold-50)'];
  return (
    <div className="rounded-xl px-4 py-3 mt-3.5 text-[13px] leading-relaxed" style={{ border: `1px solid ${c[0]}`, background: c[1] }}>
      <b style={{ color: c[0] }}>{title}.</b> {children}
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ transform: 'none' }}>
      <h2 className="font-display text-[15.5px] font-semibold m-0">{title}</h2>
      {hint && <div className="text-[12.5px] text-[var(--muted)] mt-0.5 mb-3.5 leading-relaxed">{hint}</div>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}
