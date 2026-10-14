// Shapes shared by the server (lib/metaAds.ts) and the Ads Manager screen. No server code in here.

export type MetaWindow = 'today' | 'last_7d' | 'last_30d' | 'this_month' | 'maximum';
export const WINDOWS: MetaWindow[] = ['today', 'last_7d', 'last_30d', 'this_month', 'maximum'];
export const WINDOW_LABELS: Record<MetaWindow, string> = {
  today: 'Today', last_7d: 'Last 7 days', last_30d: 'Last 30 days', this_month: 'This month', maximum: 'Everything Meta keeps',
};

export interface MetaAccount {
  id: string; name: string; currency: string; status: number; statusText: string; timezone: string;
  amountSpent: number;      // lifetime, major units
  balance: number;
}
export interface MetaCampaign {
  id: string; name: string;
  status: string;           // Meta's own effective status, e.g. ACTIVE, PAUSED, ARCHIVED
  objective: string; startTime: string; stopTime: string;
  spend: number; impressions: number; reach: number; clicks: number; leads: number;
  inList: boolean;          // false for a campaign that only shows up in the figures (deleted)
}
export interface MetaSnapshot {
  window: MetaWindow; since: string; until: string; fetchedAt: string; currency: string;
  campaigns: MetaCampaign[];
}
export interface MetaData { account?: MetaAccount; snapshots: Partial<Record<MetaWindow, MetaSnapshot>> }


export interface MetaPublicConfig {
  connected: boolean; accountId: string; tokenSet: boolean; tokenHint: string; tokenFromHosting: boolean; accountFromHosting: boolean;
  usdRate: number; taxPct: number; auto: boolean; everyMinutes: number; lastError: string; lastOkAt: string; lastRefreshAt: string;
}
