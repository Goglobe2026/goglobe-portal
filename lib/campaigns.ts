import type { Campaign, AdSpend, Lead, Case } from './types';
import { casePaid } from './finance';
import { phoneKey } from './leadImport';

// Ad payments are posted to the ledger as expenses in this category, so they
// show up in Accounts, Reports and the monthly closing without anyone
// retyping them.
export const AD_EXPENSE_CATEGORY = 'Marketing';

export type CampaignStatus = 'Running' | 'Paused' | 'Closed';
export const campaignStatus = (c: Campaign): CampaignStatus => c.status || 'Running';

export const loggedSpend = (c: Campaign) => (c.spends || []).reduce((s, x) => s + x.pkr, 0);
export const totalSpend = (c: Campaign) => (c.spend || 0) + loggedSpend(c);
export const totalUsd = (c: Campaign) => (c.spends || []).reduce((s, x) => s + (x.usd || 0), 0);
export const spendInMonth = (c: Campaign, month: string) => (c.spends || []).filter(x => x.date.slice(0, 7) === month).reduce((s, x) => s + x.pkr, 0);
export const usdInMonth = (c: Campaign, month: string) => (c.spends || []).filter(x => x.date.slice(0, 7) === month).reduce((s, x) => s + (x.usd || 0), 0);

// The monthly budget counts in a month only while the campaign is live in
// it: not before it started, not while paused, and not after it was closed.
export function budgetForMonth(c: Campaign, month: string): number {
  const b = c.monthlyBudget || 0;
  if (!b) return 0;
  if (c.startDate && c.startDate.slice(0, 7) > month) return 0;
  const status = campaignStatus(c);
  if (status === 'Paused') return 0;
  if (status === 'Closed') return c.endDate && c.endDate.slice(0, 7) >= month ? b : 0;
  return b;
}

export function matchesCampaignName(c: Campaign, name: string): boolean {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return false;
  return [c.name, c.fbName].filter(Boolean).some(x => String(x).trim().toLowerCase() === n);
}

export function matchLeads(c: Campaign, leads: Lead[]): Lead[] {
  return leads.filter(l => matchesCampaignName(c, l.campaign));
}

// What a payment really cost in rupees. Paid in dollars: dollars x rate, plus
// the tax / bank charges on top. If the exact rupee amount from the bank or
// card statement is known, that wins.
export function adPkr(input: { currency: 'USD' | 'PKR'; usd?: number; rate?: number; taxPct?: number; pkr?: number; exactPkr?: number }): { base: number; tax: number; pkr: number } {
  if (input.currency === 'PKR') {
    const pkr = Math.round(input.pkr || 0);
    return { base: pkr, tax: 0, pkr };
  }
  const base = (input.usd || 0) * (input.rate || 0);
  const tax = base * ((input.taxPct || 0) / 100);
  const computed = Math.round(base + tax);
  const pkr = input.exactPkr && input.exactPkr > 0 ? Math.round(input.exactPkr) : computed;
  return { base: Math.round(base), tax: pkr - Math.round(base), pkr };
}

export function platformPayee(platform: string) {
  if (platform === 'Facebook' || platform === 'Instagram') return 'Meta Ads (Facebook & Instagram)';
  if (platform === 'Google Ads') return 'Google Ads';
  if (platform === 'TikTok') return 'TikTok Ads';
  return platform || 'Ad platform';
}

export function spendNote(c: Campaign, s: Pick<AdSpend, 'currency' | 'usd' | 'rate' | 'taxPct' | 'note'>) {
  const bits = [`Ad campaign: ${c.name}`];
  if (s.currency === 'USD') bits.push(`$${(s.usd || 0).toLocaleString()} @ ${s.rate || 0}${s.taxPct ? ` + ${s.taxPct}% tax` : ''}`);
  if (s.note) bits.push(s.note);
  return bits.join(' — ');
}

export interface CampaignResult {
  leads: number; converted: number; lost: number; spend: number;
  cpl: number; cpc: number; revenue: number; returnX: number;
}

// How a campaign did: leads it brought in, how many became clients, the money
// those clients have paid so far, and what each lead / client cost.
export function campaignResult(c: Campaign, leads: Lead[], cases: Case[]): CampaignResult {
  const mine = matchLeads(c, leads);
  const converted = mine.filter(l => l.stage === 'Converted');
  const lost = mine.filter(l => l.stage === 'Lost').length;
  const spend = totalSpend(c);
  const keys = new Set(converted.map(l => phoneKey(l.phone)).filter(Boolean));
  const revenue = cases.filter(k => keys.has(phoneKey(k.phone))).reduce((s, k) => s + casePaid(k), 0);
  return {
    leads: mine.length, converted: converted.length, lost, spend,
    cpl: mine.length ? Math.round(spend / mine.length) : 0,
    cpc: converted.length ? Math.round(spend / converted.length) : 0,
    revenue, returnX: spend > 0 ? revenue / spend : 0,
  };
}

// The most recent dollar payment's rate and tax, used to pre-fill the next one.
// With no payments yet, the rate and tax typed into a dollar budget are used.
export function lastRateAndTax(campaigns: Campaign[]): { rate: number; taxPct: number } | null {
  const all = campaigns.flatMap(c => c.spends || []).filter(s => s.currency === 'USD' && s.rate);
  if (all.length) {
    all.sort((a, b) => b.date.localeCompare(a.date));
    return { rate: all[0].rate || 0, taxPct: all[0].taxPct || 0 };
  }
  const budgets = campaigns.filter(c => c.budgetRate).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  return budgets.length ? { rate: budgets[0].budgetRate || 0, taxPct: budgets[0].budgetTaxPct || 0 } : null;
}
