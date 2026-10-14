'use client';
import { useState } from 'react';
import { useAppData } from '@/lib/AppDataContext';
import { money, fmtDate, genId, today } from '@/lib/constants';
import { Modal, ModalTitle, ModalFoot, Field, SectionHead, EmptyState } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import { readFileAsDataUrl, MAX_PDF_BYTES } from '@/lib/fileUpload';
import {
  AD_EXPENSE_CATEGORY, campaignStatus, totalSpend, totalUsd, spendInMonth, usdInMonth, budgetForMonth,
  campaignResult, adPkr, platformPayee, spendNote, lastRateAndTax,
} from '@/lib/campaigns';
import type { Campaign, AdSpend } from '@/lib/types';

const PLATFORMS = ['Facebook', 'Instagram', 'WhatsApp Business', 'Google Ads', 'TikTok', 'Other'];
const FILTERS = ['Running', 'Paused', 'Closed', 'All'] as const;
type Filter = typeof FILTERS[number];

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Running: { bg: 'var(--green-50)', fg: 'var(--green)' },
  Paused: { bg: 'var(--gold-50)', fg: '#8a5a12' },
  Closed: { bg: '#F0F1F4', fg: 'var(--muted)' },
};
function StatusPill({ status }: { status: string }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE.Running;
  return <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: st.bg, color: st.fg }}>{status}</span>;
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[22px] font-bold mt-1" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? spent / budget : 0;
  const color = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? 'var(--gold)' : 'var(--green)';
  return (
    <div style={{ minWidth: 190 }}>
      <div className="font-mono-ui text-xs whitespace-nowrap">{money(spent)} <span className="text-[var(--muted)]">of {money(budget)}</span></div>
      <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.round(pct * 100))}%`, height: '100%', background: color }} />
      </div>
      <div className="text-[10.5px] mt-0.5" style={{ color }}>{pct >= 1 ? `Over budget by ${money(spent - budget)}` : `${money(budget - spent)} left`}</div>
    </div>
  );
}

export function Campaigns() {
  const { campaigns, leads, cases } = useAppData();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<Filter>('Running');
  const [openId, setOpenId] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [closeFor, setCloseFor] = useState<string | null>(null);
  const month = today().slice(0, 7);

  const shown = campaigns.filter(c => filter === 'All' || campaignStatus(c) === filter);
  const spentMonth = campaigns.reduce((s, c) => s + spendInMonth(c, month), 0);
  const usdMonth = campaigns.reduce((s, c) => s + usdInMonth(c, month), 0);
  const budgetMonth = campaigns.reduce((s, c) => s + budgetForMonth(c, month), 0);
  const running = campaigns.filter(c => campaignStatus(c) === 'Running').length;
  const left = budgetMonth - spentMonth;
  const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div>
      <SectionHead title="Campaign performance" count={`${running} running · ${campaigns.length} in total`} action={
        <button className="btn btn-sm ml-auto" onClick={() => setShowNew(true)}>+ Add campaign</button>
      } />

      {campaigns.length > 0 && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <Tile label={`Ad spend — ${monthName}`} value={money(spentMonth)} sub={usdMonth ? `$${usdMonth.toLocaleString()} paid in dollars, tax included in rupees` : 'posted to Accounts as Marketing'} />
          <Tile label="Monthly budget" value={budgetMonth ? money(budgetMonth) : '—'} sub={budgetMonth ? 'running campaigns this month' : 'set a budget on each campaign'} />
          <Tile label={left >= 0 ? 'Left to spend' : 'Over budget'} value={budgetMonth ? money(Math.abs(left)) : '—'} color={budgetMonth ? (left >= 0 ? 'var(--green)' : 'var(--red)') : undefined} />
          <Tile label="Running now" value={String(running)} sub={`${campaigns.filter(c => campaignStatus(c) === 'Closed').length} closed`} />
        </div>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        {FILTERS.map(f => {
          const n = f === 'All' ? campaigns.length : campaigns.filter(c => campaignStatus(c) === f).length;
          return <button key={f} className="btn btn-sm" style={filter === f ? { background: 'var(--navy)', color: '#fff', borderColor: 'transparent' } : {}} onClick={() => setFilter(f)}>{f} ({n})</button>;
        })}
      </div>

      {!campaigns.length ? (
        <EmptyState title="No campaigns yet" body="Add each ad campaign you run, log what you pay in dollars, and see budget, cost per lead and cost per client." />
      ) : !shown.length ? (
        <EmptyState title={`No ${filter.toLowerCase()} campaigns`} body="Switch the filter above to see the others." />
      ) : (
        <div className="card p-0 overflow-auto">
          <table className="campaigns-table">
            <thead><tr><th>Campaign</th><th>{monthName.split(' ')[0]} spend / budget</th><th>Total spend</th><th>Leads</th><th>Closed / lost</th><th>Cost/lead</th><th>Cost/close</th><th></th></tr></thead>
            <tbody>
              {shown.map(cp => {
                const r = campaignResult(cp, leads, cases);
                const status = campaignStatus(cp);
                const budget = budgetForMonth(cp, month) || cp.monthlyBudget || 0;
                const spent = spendInMonth(cp, month);
                const usd = totalUsd(cp);
                return (
                  <tr key={cp.id} style={status === 'Closed' ? { opacity: 0.75 } : undefined}>
                    <td className="font-medium">
                      <button className="underline decoration-[var(--line)] text-left" onClick={() => setOpenId(cp.id)}>{cp.name}</button>
                      <div className="mt-1"><StatusPill status={status} /></div>
                      <div className="mt-0.5">
                        <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">{cp.platform} · {status === 'Closed' && cp.endDate ? `${fmtDate(cp.startDate)} → ${fmtDate(cp.endDate)}` : `since ${fmtDate(cp.startDate)}`}</span>
                      </div>
                    </td>
                    <td>{budget ? <BudgetBar spent={spent} budget={budget} /> : <span className="font-mono-ui text-xs">{money(spent)}<div className="text-[10.5px] text-[var(--faint)]">no budget set</div></span>}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{money(r.spend)}{usd > 0 && <div className="text-[10.5px] text-[var(--muted)]">${usd.toLocaleString()} paid</div>}</td>
                    <td className="font-mono-ui text-xs">{r.leads}</td>
                    <td className="font-mono-ui text-xs">{r.converted} / {r.lost}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{r.cpl ? money(r.cpl) : '—'}</td>
                    <td className="font-mono-ui text-xs whitespace-nowrap">{r.cpc ? money(r.cpc) : '—'}</td>
                    <td>
                      <div className="flex gap-1.5 justify-end whitespace-nowrap">
                        {status !== 'Closed' && <button className="btn btn-sm" onClick={() => setLogFor(cp.id)}>Log payment</button>}
                        <button className="btn btn-sm btn-primary" onClick={() => setOpenId(cp.id)}>Open</button>
                        {status !== 'Closed' && <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setCloseFor(cp.id)}>Close</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MarketingMaterialsLibrary />

      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <ModalTitle>New campaign</ModalTitle>
        <NewCampaignForm onClose={() => setShowNew(false)} />
      </Modal>
      <Modal open={!!openId} onClose={() => setOpenId(null)} wide>
        {openId && <CampaignFile campaignId={openId} onClose={() => setOpenId(null)} onLog={() => { setLogFor(openId); }} onCloseCampaign={() => { setCloseFor(openId); }} />}
      </Modal>
      <Modal open={!!logFor} onClose={() => setLogFor(null)}>
        {logFor && <LogPaymentForm campaignId={logFor} onClose={() => setLogFor(null)} />}
      </Modal>
      <Modal open={!!closeFor} onClose={() => setCloseFor(null)}>
        {closeFor && <CloseCampaignForm campaignId={closeFor} onClose={() => setCloseFor(null)} onLog={() => { setLogFor(closeFor); setCloseFor(null); }} />}
      </Modal>
    </div>
  );
}

function MarketingMaterialsLibrary() {
  const { marketingMaterials, setMarketingMaterials } = useAppData();
  const toast = useToast();
  const [name, setName] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Please choose a PDF file'); return; }
    if (file.size > MAX_PDF_BYTES) { toast('PDF is too large — please keep it under 4MB'); return; }
    if (!name.trim()) { toast('Give it a name first, e.g. "UK Tourist Visa Flyer"'); return; }
    const dataUrl = await readFileAsDataUrl(file);
    setMarketingMaterials(prev => [...prev, { id: genId('mm'), name: name.trim(), pdf: dataUrl, pdfName: file.name, uploadedAt: today() }]);
    setName('');
    e.target.value = '';
    toast('Uploaded — staff can now send this to leads');
  }

  return (
    <>
      <SectionHead title="Marketing materials" count={`${marketingMaterials.length} uploaded — flyers, brochures, rate sheets staff can send to leads`} />
      <div className="card mb-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name this document"><input value={name} onChange={e => setName(e.target.value)} placeholder='e.g. "UK Tourist Visa Flyer"' /></Field>
          <Field label="Upload PDF (under 4MB)"><input type="file" accept="application/pdf" onChange={handleFile} /></Field>
        </div>
      </div>
      {marketingMaterials.length > 0 && (
        <div className="card p-0 overflow-auto">
          <table>
            <thead><tr><th>Name</th><th>Uploaded</th><th></th></tr></thead>
            <tbody>
              {marketingMaterials.map(m => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td>
                  <td className="font-mono-ui text-xs">{fmtDate(m.uploadedAt)}</td>
                  <td>
                    <div className="flex gap-1.5 justify-end">
                      <a href={m.pdf} download={m.pdfName} className="btn btn-sm">Download</a>
                      <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setMarketingMaterials(prev => prev.filter(x => x.id !== m.id))}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}


// Budget in dollars or rupees. In dollars it needs the rate and the tax, and
// shows what that comes to in rupees.
type Budget = { pkr: number; usd: number; rate?: number; taxPct?: number };
function BudgetInput({ pkr, usd, rate: rate0, taxPct: tax0, onChange }: { pkr: number; usd: number; rate?: number; taxPct?: number; onChange: (v: Budget) => void }) {
  const { campaigns } = useAppData();
  const last = lastRateAndTax(campaigns);
  const [cur, setCur] = useState<'USD' | 'PKR'>(pkr > 0 && usd === 0 ? 'PKR' : 'USD'); // ad budgets are paid in dollars, so start there
  const [amount, setAmount] = useState(String(usd > 0 ? usd : pkr || ''));
  const [rate, setRate] = useState(String(rate0 || last?.rate || ''));
  const [tax, setTax] = useState(String(tax0 ?? last?.taxPct ?? ''));

  function push(nextCur: 'USD' | 'PKR', nextAmount: string, nextRate: string, nextTax: string) {
    const a = Number(nextAmount) || 0;
    if (nextCur === 'PKR') onChange({ pkr: Math.round(a), usd: 0 });
    else onChange({ pkr: adPkr({ currency: 'USD', usd: a, rate: Number(nextRate) || 0, taxPct: Number(nextTax) || 0 }).pkr, usd: a, rate: Number(nextRate) || undefined, taxPct: Number(nextTax) || 0 });
  }
  return (
    <div>
      <div className="grid gap-3" style={{ gridTemplateColumns: cur === 'USD' ? '1fr 1fr 1fr 1fr' : '1fr 1fr' }}>
        <Field label="Monthly budget in">
          <select value={cur} onChange={e => { const v = e.target.value as 'USD' | 'PKR'; setCur(v); push(v, amount, rate, tax); }}>
            <option value="USD">US dollars ($)</option><option value="PKR">Rupees (PKR)</option>
          </select>
        </Field>
        <Field label="Amount per month"><input type="number" min={0} value={amount} placeholder="0" onChange={e => { setAmount(e.target.value); push(cur, e.target.value, rate, tax); }} /></Field>
        {cur === 'USD' && <Field label="Rate (PKR per $1)"><input type="number" min={0} step="0.01" value={rate} placeholder="e.g. 280" onChange={e => { setRate(e.target.value); push(cur, amount, e.target.value, tax); }} /></Field>}
        {cur === 'USD' && <Field label="Tax / charges %"><input type="number" min={0} step="0.1" value={tax} placeholder="e.g. 5" onChange={e => { setTax(e.target.value); push(cur, amount, rate, e.target.value); }} /></Field>}
      </div>
      {cur === 'USD' && Number(amount) > 0 && <div className="text-[12px] text-[var(--muted)] -mt-1 mb-3">= <b>{money(pkr)}</b> per month in rupees{!Number(rate) && <span style={{ color: 'var(--red)' }}> — enter the rate</span>}</div>}
    </div>
  );
}

function NewCampaignForm({ onClose }: { onClose: () => void }) {
  const { setCampaigns } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(''); const [platform, setPlatform] = useState('Facebook');
  const [fbName, setFbName] = useState(''); const [spend, setSpend] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [budget, setBudget] = useState<Budget>({ pkr: 0, usd: 0 });

  function save() {
    if (!name.trim()) { toast('Enter a campaign name'); return; }
    setCampaigns(prev => [...prev, {
      id: genId('cp'), name: name.trim(), platform, spend: Number(spend) || 0, startDate, status: 'Running',
      monthlyBudget: budget.pkr || undefined, budgetUsd: budget.usd || undefined, budgetRate: budget.usd ? budget.rate : undefined, budgetTaxPct: budget.usd ? budget.taxPct : undefined, fbName: fbName.trim() || undefined, spends: [],
    }]);
    toast('Campaign added — log each payment as you make it');
    onClose();
  }

  return (
    <>
      <Field label="Campaign name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. UK Visit Visa — October" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform">
          <select value={platform} onChange={e => setPlatform(e.target.value)}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</select>
        </Field>
        <Field label="Start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
      </div>
      <Field label="Name in Facebook Ads Manager (optional)">
        <input value={fbName} onChange={e => setFbName(e.target.value)} placeholder="Only if it is different — leads from your sheet are matched by this name" />
      </Field>
      <BudgetInput pkr={budget.pkr} usd={budget.usd} onChange={setBudget} />
      <Field label="Already spent before today (PKR, optional — not added to the books)"><input type="number" min={0} value={spend} onChange={e => setSpend(e.target.value)} placeholder="0" /></Field>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save campaign</button>
      </ModalFoot>
    </>
  );
}

// Log one payment to the ad platform. It is saved on the campaign AND posted
// to Accounts as an expense, so nothing has to be typed twice.
function LogPaymentForm({ campaignId, editId, onClose }: { campaignId: string; editId?: string; onClose: () => void }) {
  const { campaigns, setCampaigns, setTransactions } = useAppData();
  const toast = useToast();
  const cp = campaigns.find(c => c.id === campaignId)!;
  const editing = editId ? (cp.spends || []).find(s => s.id === editId) : undefined;
  const last = lastRateAndTax(campaigns);

  const [date, setDate] = useState(editing?.date || today());
  const [cur, setCur] = useState<'USD' | 'PKR'>(editing?.currency || 'USD');
  const [usd, setUsd] = useState(editing?.usd ? String(editing.usd) : '');
  const [rate, setRate] = useState(editing?.rate ? String(editing.rate) : last ? String(last.rate) : '');
  const [tax, setTax] = useState(editing?.taxPct !== undefined ? String(editing.taxPct) : last ? String(last.taxPct) : '');
  const [pkrDirect, setPkrDirect] = useState(editing && editing.currency === 'PKR' ? String(editing.pkr) : '');
  // An edited payment that was saved with an exact statement amount keeps it.
  const calcOnOpen = editing && editing.currency === 'USD' ? adPkr({ currency: 'USD', usd: editing.usd, rate: editing.rate, taxPct: editing.taxPct }).pkr : 0;
  const [exact, setExact] = useState(editing && editing.currency === 'USD' && editing.pkr !== calcOnOpen ? String(editing.pkr) : '');
  const [note, setNote] = useState(editing?.note || '');

  const calc = adPkr({ currency: cur, usd: Number(usd), rate: Number(rate), taxPct: Number(tax), pkr: Number(pkrDirect), exactPkr: Number(exact) });

  function save() {
    if (calc.pkr <= 0) { toast(cur === 'USD' ? 'Enter the dollar amount and the rate' : 'Enter the amount'); return; }
    if (cur === 'USD' && (!Number(usd) || (!Number(rate) && !Number(exact)))) { toast('Enter the dollar amount and the rate'); return; }
    const spendId = editing?.id || genId('ad');
    const txId = editing?.txId || genId('tx');
    const entry: AdSpend = {
      id: spendId, date, currency: cur, txId, pkr: calc.pkr, note: note.trim() || undefined,
      ...(cur === 'USD' ? { usd: Number(usd), rate: Number(rate) || undefined, taxPct: Number(tax) || 0 } : {}),
    };
    setCampaigns(prev => prev.map(c => c.id !== campaignId ? c : {
      ...c, spends: editing ? (c.spends || []).map(x => x.id === spendId ? entry : x) : [...(c.spends || []), entry],
    }));
    const txBody = { date, type: 'Expense' as const, category: AD_EXPENSE_CATEGORY, party: platformPayee(cp.platform), amount: calc.pkr, note: spendNote(cp, entry), campaignId, adSpendId: spendId };
    setTransactions(prev => editing && prev.some(t => t.id === txId)
      ? prev.map(t => t.id === txId ? { ...t, ...txBody } : t)
      : [...prev, { id: txId, ...txBody }]);
    toast(editing ? 'Payment updated in the campaign and in Accounts' : `${money(calc.pkr)} logged and added to your expenses`);
    onClose();
  }

  return (
    <>
      <ModalTitle>{editing ? 'Edit payment' : 'Log an ad payment'} — {cp.name}</ModalTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date paid"><input type="date" max={today()} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Paid in">
          <select value={cur} onChange={e => setCur(e.target.value as 'USD' | 'PKR')}>
            <option value="USD">US dollars ($) — card or bank, converted to rupees</option>
            <option value="PKR">Rupees (PKR) — paid directly</option>
          </select>
        </Field>
      </div>
      {cur === 'USD' ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Amount charged ($)"><input type="number" min={0} step="0.01" value={usd} onChange={e => setUsd(e.target.value)} placeholder="e.g. 120" /></Field>
            <Field label="Rate (PKR per $1)"><input type="number" min={0} step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 280" /></Field>
            <Field label="Tax / bank charges %"><input type="number" min={0} step="0.1" value={tax} onChange={e => setTax(e.target.value)} placeholder="e.g. 5" /></Field>
          </div>
          <div className="card mb-3" style={{ background: 'var(--navy-50)', padding: '10px 14px' }}>
            <div className="text-[12.5px] text-[var(--muted)]">
              ${Number(usd) || 0} × {Number(rate) || 0} = {money(calc.base)}{Number(tax) > 0 && !Number(exact) ? ` + ${tax}% tax = ` : ' → '}
            </div>
            <div className="font-display text-[20px] font-bold" style={{ color: 'var(--navy)' }}>{money(calc.pkr)} <span className="text-[12px] font-normal text-[var(--muted)]">cost in rupees{calc.tax > 0 ? ` (includes ${money(calc.tax)} tax / charges)` : ''}</span></div>
          </div>
          <Field label="Exact rupees on your bank / card statement (optional — overrides the calculation)">
            <input type="number" min={0} value={exact} onChange={e => setExact(e.target.value)} placeholder="Leave empty to use the calculation above" />
          </Field>
        </>
      ) : (
        <Field label="Amount paid (PKR)"><input type="number" min={0} value={pkrDirect} onChange={e => setPkrDirect(e.target.value)} placeholder="e.g. 35000" /></Field>
      )}
      <Field label="Note (optional)"><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Meta invoice number, card used" /></Field>
      <div className="text-[11.5px] text-[var(--faint)] -mt-1 mb-2">This is added to your expenses in Accounts as <b>{AD_EXPENSE_CATEGORY}</b> on the date paid, so it is counted in the monthly closing automatically.</div>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{editing ? 'Save changes' : 'Log payment'}</button>
      </ModalFoot>
    </>
  );
}

function ResultGrid({ campaign }: { campaign: Campaign }) {
  const { leads, cases } = useAppData();
  const r = campaignResult(campaign, leads, cases);
  const cell = (label: string, value: string, sub?: string) => (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div className="text-[10.5px] uppercase tracking-wide font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-display text-[18px] font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
  return (
    <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      {cell('Total spend', money(r.spend), totalUsd(campaign) ? `$${totalUsd(campaign).toLocaleString()} paid` : undefined)}
      {cell('Leads', String(r.leads), r.cpl ? `${money(r.cpl)} each` : undefined)}
      {cell('Became clients', String(r.converted), r.cpc ? `${money(r.cpc)} each` : `${r.lost} lost`)}
      {cell('Paid by those clients', r.revenue ? money(r.revenue) : '—', r.returnX ? `${r.returnX.toFixed(1)}× the spend` : undefined)}
    </div>
  );
}

function CampaignFile({ campaignId, onClose, onLog, onCloseCampaign }: { campaignId: string; onClose: () => void; onLog: () => void; onCloseCampaign: () => void }) {
  const { campaigns, setCampaigns, setTransactions } = useAppData();
  const toast = useToast();
  const cp = campaigns.find(c => c.id === campaignId);
  const [name, setName] = useState(cp?.name || ''); const [platform, setPlatform] = useState(cp?.platform || 'Facebook');
  const [fbName, setFbName] = useState(cp?.fbName || ''); const [startDate, setStartDate] = useState(cp?.startDate || today());
  const [budget, setBudget] = useState<Budget>({ pkr: cp?.monthlyBudget || 0, usd: cp?.budgetUsd || 0, rate: cp?.budgetRate, taxPct: cp?.budgetTaxPct });
  const [editPay, setEditPay] = useState<string | null>(null);
  if (!cp) return null;
  const status = campaignStatus(cp);
  const spends = [...(cp.spends || [])].sort((a, b) => b.date.localeCompare(a.date));

  function saveDetails() {
    if (!name.trim()) { toast('Enter a campaign name'); return; }
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, name: name.trim(), platform, fbName: fbName.trim() || undefined, startDate, monthlyBudget: budget.pkr || undefined, budgetUsd: budget.usd || undefined, budgetRate: budget.usd ? budget.rate : undefined, budgetTaxPct: budget.usd ? budget.taxPct : undefined } : c));
    toast('Saved');
  }
  function setStatus(next: 'Running' | 'Paused') {
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: next } : c));
    toast(next === 'Paused' ? 'Paused — its budget stops counting until you resume' : 'Running again');
  }
  function reopen() {
    setCampaigns(prev => prev.map(c => { if (c.id !== campaignId) return c; const { endDate, closeNote, ...rest } = c; void endDate; void closeNote; return { ...rest, status: 'Running' }; }));
    toast('Campaign re-opened');
  }
  function removePayment(s: AdSpend) {
    if (!confirm(`Remove this ${money(s.pkr)} payment? It will also be removed from your expenses in Accounts.`)) return;
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, spends: (c.spends || []).filter(x => x.id !== s.id) } : c));
    setTransactions(prev => prev.filter(t => t.id !== s.txId));
    toast('Payment removed');
  }
  function deleteCampaign() {
    const n = (cp!.spends || []).length;
    if (!confirm(`Delete the campaign "${cp!.name}"?${n ? `\n\nIts ${n} logged payment${n === 1 ? '' : 's'} stay in your expenses in Accounts, because that money was really spent.` : ''}`)) return;
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    onClose();
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-display text-[17px] m-0">{cp.name}</h3><StatusPill status={status} />
        {cp.autoCreated && <span className="text-[10.5px] text-[var(--faint)]">created automatically from your lead sheet</span>}
      </div>
      <ResultGrid campaign={cp} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Campaign name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Platform"><select value={platform} onChange={e => setPlatform(e.target.value)}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Name in Facebook Ads Manager (if different)"><input value={fbName} onChange={e => setFbName(e.target.value)} placeholder="Leads from your sheet are matched by this name" /></Field>
        <Field label="Start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
      </div>
      <BudgetInput pkr={budget.pkr} usd={budget.usd} rate={budget.rate} taxPct={budget.taxPct} onChange={setBudget} />
      <button className="btn btn-sm mb-4" onClick={saveDetails}>Save details</button>

      <SectionHead title="Payments" count={`${spends.length} logged${cp.spend ? ` · plus ${money(cp.spend)} earlier spend not in the books` : ''}`} action={
        status !== 'Closed' ? <button className="btn btn-sm ml-auto" onClick={onLog}>+ Log payment</button> : undefined
      } />
      {spends.length ? (
        <div className="card p-0 overflow-auto mb-4">
          <table>
            <thead><tr><th>Date</th><th>Paid</th><th>Rate</th><th>Tax</th><th>Cost in rupees</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {spends.map(s => (
                <tr key={s.id}>
                  <td className="font-mono-ui text-xs">{fmtDate(s.date)}</td>
                  <td className="font-mono-ui text-xs">{s.currency === 'USD' ? `$${(s.usd || 0).toLocaleString()}` : 'Rupees'}</td>
                  <td className="font-mono-ui text-xs">{s.currency === 'USD' ? (s.rate || '—') : '—'}</td>
                  <td className="font-mono-ui text-xs">{s.currency === 'USD' ? `${s.taxPct || 0}%` : '—'}</td>
                  <td className="font-mono-ui text-xs font-semibold">{money(s.pkr)}</td>
                  <td className="text-[12px] text-[var(--muted)]">{s.note || ''}</td>
                  <td><div className="flex gap-1.5 justify-end">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditPay(s.id)}>Edit</button>
                    <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removePayment(s)}>Remove</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="text-[13px] text-[var(--muted)] mb-4">No payments logged yet. Each payment you log is added to your expenses automatically.</div>}

      {status === 'Closed' && (
        <div className="card mb-4" style={{ background: '#F0F1F4' }}>
          <div className="text-[13px]">Closed on <b>{cp.endDate ? fmtDate(cp.endDate) : '—'}</b>. {cp.closeNote && <>Note: {cp.closeNote}</>}</div>
        </div>
      )}

      <ModalFoot>
        <button className="btn btn-ghost btn-danger mr-auto" onClick={deleteCampaign}>Delete campaign</button>
        {status === 'Running' && <button className="btn" onClick={() => setStatus('Paused')}>Pause</button>}
        {status === 'Paused' && <button className="btn" onClick={() => setStatus('Running')}>Resume</button>}
        {status === 'Closed' ? <button className="btn" onClick={reopen}>Re-open</button> : <button className="btn" onClick={onCloseCampaign}>Close campaign…</button>}
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </ModalFoot>

      <Modal open={!!editPay} onClose={() => setEditPay(null)}>
        {editPay && <LogPaymentForm campaignId={campaignId} editId={editPay} onClose={() => setEditPay(null)} />}
      </Modal>
    </>
  );
}

// Ending a campaign: fix its end date and keep the result. Its payments stay
// in the books; from the end month on its budget no longer counts.
function CloseCampaignForm({ campaignId, onClose, onLog }: { campaignId: string; onClose: () => void; onLog: () => void }) {
  const { campaigns, setCampaigns } = useAppData();
  const toast = useToast();
  const cp = campaigns.find(c => c.id === campaignId);
  const [endDate, setEndDate] = useState(today());
  const [note, setNote] = useState('');
  if (!cp) return null;
  const month = endDate.slice(0, 7);

  function close() {
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'Closed', endDate, closeNote: note.trim() || undefined } : c));
    toast(`"${cp!.name}" closed — it no longer counts in next month's budget`);
    onClose();
  }
  return (
    <>
      <ModalTitle>Close campaign — {cp.name}</ModalTitle>
      <ResultGrid campaign={cp} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Last day it ran"><input type="date" min={cp.startDate} value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
        <Field label="Note (optional)"><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Europe season finished" /></Field>
      </div>
      <div className="text-[12.5px] text-[var(--muted)] leading-relaxed mb-1">
        Everything paid so far ({money(totalSpend(cp))}) is already in your expenses and in the monthly closing. After closing, this campaign&apos;s budget stops counting after {new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}, and new leads carrying its name are still matched to it. You can re-open it any time.
      </div>
      <button className="btn btn-sm mt-2" onClick={onLog}>Last bill not logged yet? Log it first</button>
      <ModalFoot>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={close}>Close campaign</button>
      </ModalFoot>
    </>
  );
}
