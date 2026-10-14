import { updateCollectionSync } from './store';
import { genId } from './constants';
import { matchesCampaignName } from './campaigns';
import type { Lead, Campaign } from './types';

// When a lead arrives from a sheet or the website with a campaign name the
// portal has never seen, make a Running campaign record for it so it shows up
// in Campaigns straight away (ready for a budget and payments). Runs on the
// server, right after the leads are saved.
export function ensureCampaignsFor(leads: Lead[]) {
  const named = leads.filter(l => (l.campaign || '').trim());
  if (!named.length) return;
  updateCollectionSync('campaigns', current => {
    const add: Campaign[] = [];
    for (const l of named) {
      const name = l.campaign.trim();
      if (current.some(c => matchesCampaignName(c, name)) || add.some(c => matchesCampaignName(c, name))) continue;
      const earliest = named.filter(x => x.campaign.trim().toLowerCase() === name.toLowerCase()).map(x => x.createdAt).sort()[0] || l.createdAt;
      add.push({
        id: genId('cp'), name, platform: platformFromSource(l.source), spend: 0,
        startDate: earliest, status: 'Running', spends: [], autoCreated: true,
      });
    }
    return add.length ? [...current, ...add] : current;
  });
}

function platformFromSource(source: string) {
  const s = (source || '').toLowerCase();
  if (s.includes('insta')) return 'Instagram';
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('google')) return 'Google Ads';
  return 'Facebook';
}
