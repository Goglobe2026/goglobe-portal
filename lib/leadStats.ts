import type { Lead, LeadSource, Campaign, Case } from './types';
import { casePaid, caseCharge } from './finance';
import { phoneKey } from './leadImport';
import { matchesCampaignName, totalSpend } from './campaigns';

// What happened to the leads of one lead source (one ad form), and what each
// answer people gave is worth. Pure functions — the screen just draws them.

export type PayState = 'No file yet' | 'Unpaid' | 'Part paid' | 'Paid in full';
export interface LeadPayment { state: PayState; charge: number; paid: number; outstanding: number }

// A converted lead's money, found through the case with the same phone number.
export function leadPayment(lead: Lead, cases: Case[]): LeadPayment {
  const key = phoneKey(lead.phone);
  const mine = key ? cases.filter(c => phoneKey(c.phone) === key) : [];
  if (!mine.length) return { state: 'No file yet', charge: 0, paid: 0, outstanding: 0 };
  const charge = mine.reduce((s, c) => s + caseCharge(c), 0);
  const paid = mine.reduce((s, c) => s + casePaid(c), 0);
  const outstanding = Math.max(0, charge - paid);
  const state: PayState = paid <= 0 ? 'Unpaid' : outstanding > 0 ? 'Part paid' : 'Paid in full';
  return { state, charge, paid, outstanding };
}

export interface AnswerRow { answer: string; leads: number; converted: number; pct: number }
export interface QuestionRow { question: string; answered: number; answers: AnswerRow[] }

export interface SourceStats {
  id: string; name: string; country: string; campaign: string;
  leads: number; contacted: number; qualified: number; converted: number; lost: number; waiting: number;
  contactedPct: number; qualifiedPct: number; convertedPct: number;
  spend: number; cpl: number; cpc: number;            // cost per lead / per client
  revenue: number; outstanding: number;
  full: number; part: number; unpaid: number;          // clients by payment state
  questions: QuestionRow[];
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export function questionBreakdown(leads: Lead[], minLeads = 1): QuestionRow[] {
  const byQ = new Map<string, Map<string, { leads: number; converted: number }>>();
  for (const l of leads) {
    for (const [q, a] of Object.entries(l.answers || {})) {
      if (!a) continue;
      const m = byQ.get(q) || new Map();
      const cur = m.get(a) || { leads: 0, converted: 0 };
      cur.leads++; if (l.stage === 'Converted') cur.converted++;
      m.set(a, cur); byQ.set(q, m);
    }
  }
  return [...byQ.entries()].map(([question, m]) => {
    const answers = [...m.entries()].map(([answer, v]) => ({ answer, leads: v.leads, converted: v.converted, pct: pct(v.converted, v.leads) }))
      .sort((a, b) => b.leads - a.leads || b.converted - a.converted);
    return { question, answered: answers.reduce((s, a) => s + a.leads, 0), answers };
  }).filter(q => q.answered >= minLeads).sort((a, b) => b.answered - a.answered);
}

export function sourceStats(src: LeadSource | null, leads: Lead[], campaigns: Campaign[], cases: Case[], allSources: LeadSource[] = []): SourceStats {
  const mine = src ? leads.filter(l => l.sourceId === src.id) : leads.filter(l => !l.sourceId);
  const converted = mine.filter(l => l.stage === 'Converted');
  const lost = mine.filter(l => l.stage === 'Lost').length;
  const contacted = mine.filter(l => l.stage !== 'New').length;
  const qualified = mine.filter(l => l.stage === 'Qualified' || l.stage === 'Converted').length;
  const waiting = mine.filter(l => l.stage === 'New').length;

  // The campaign's ad spend is shared between the sources that use the campaign, by number of leads.
  let spend = 0;
  const cp = src && src.campaign ? campaigns.find(c => matchesCampaignName(c, src.campaign)) : undefined;
  if (cp) {
    const sameCampaignSources = allSources.filter(s => s.campaign && matchesCampaignName(cp, s.campaign)).map(s => s.id);
    const inCampaign = leads.filter(l => (l.sourceId && sameCampaignSources.includes(l.sourceId)) || (!l.sourceId && matchesCampaignName(cp, l.campaign))).length;
    spend = inCampaign > 0 ? Math.round(totalSpend(cp) * (mine.length / inCampaign)) : 0;
  }
  let revenue = 0, outstanding = 0, full = 0, part = 0, unpaid = 0;
  for (const l of converted) {
    const p = leadPayment(l, cases);
    revenue += p.paid; outstanding += p.outstanding;
    if (p.state === 'Paid in full') full++; else if (p.state === 'Part paid') part++; else if (p.state === 'Unpaid') unpaid++;
  }
  return {
    id: src?.id || '', name: src?.name || 'Not linked to a source', country: src?.country || '', campaign: src?.campaign || '',
    leads: mine.length, contacted, qualified, converted: converted.length, lost, waiting,
    contactedPct: pct(contacted, mine.length), qualifiedPct: pct(qualified, mine.length), convertedPct: pct(converted.length, mine.length),
    spend, cpl: mine.length && spend ? Math.round(spend / mine.length) : 0, cpc: converted.length && spend ? Math.round(spend / converted.length) : 0,
    revenue, outstanding, full, part, unpaid,
    questions: questionBreakdown(mine),
  };
}
