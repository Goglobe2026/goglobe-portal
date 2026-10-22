// Provider research for the five countries the team books for first, and the "adapter" each one uses.
//
// What this file is: facts read from official and news pages on 16 October 2026, and an honest
// statement of what the portal may do with them. For every one of the five countries the answer
// to "is there an approved feed, API or alert service we may plug into?" was NO — so every adapter
// runs in 'manual' mode: people report what they see, the engine checks and files it. If a provider
// ever approves access in writing, the new adapter would feed the same engine through `ingest`.

export const FIVE_COUNTRIES = ['Belgium', 'France', 'Spain', 'Switzerland', 'Norway'] as const;

export type Verified = 'Verified on an official page' | 'Partly verified' | 'Unverified';
export interface EvidenceLink { label: string; url: string }

export interface ProviderRow {
  country: string;
  provider: string;
  officialUrl: string;
  centres: string;
  advanceRelease: string;          // are release dates published in advance?
  integration: string;             // is an approved API / partner feed / alert service available?
  automation: string;              // is automated monitoring permitted?
  whoBooks: string;                // who may make the booking
  evidence: EvidenceLink[];
  verified: Verified;
  verifiedNote: string;            // what exactly was and was not checked
  status: string;                  // implementation status in this portal
}

const MANUAL_STATUS = 'Manual workflow is live. Automatic checking is OFF because no approved access exists.';

const VFS_STATEMENT: EvidenceLink = { label: 'VFS Global anti-fraud measures, June 2025 (news report — general, not a Pakistan page)', url: 'https://www.kenyans.co.ke/news/113464-vfs-global-unveils-5-new-measures-curb-visa-appointment-fraud?page=97' };
const VFS_TERMS: EvidenceLink = { label: 'VFS website terms (the Australia–India version; Pakistan’s own page was not opened)', url: 'https://visa.vfsglobal.com/aus/en/ind/terms-and-condition' };
const VFS_AUTOMATION = 'Not offered. VFS says it added a one-time password at booking to limit agents (a general VFS statement, not a Pakistan page), and its website terms forbid copying or misusing the site. No permission for monitoring tools was found.';

export const PROVIDER_TABLE: ProviderRow[] = [
  {
    country: 'Belgium',
    provider: 'VFS Global with Gerry’s International, reached through Belgium’s Visa On Web (VOW) form',
    officialUrl: 'https://pakistan.diplomatie.belgium.be/en/travel-belgium/visa-belgium-and-grand-duchy-luxembourg/online-visa-application-procedure',
    centres: 'Islamabad, Lahore, Karachi',
    advanceRelease: 'None published. The embassy pages give no release dates or times; the only dated rule is that the online form is valid for 30 days.',
    integration: 'None found. No API, partner feed or alert service is described on the embassy page or the VFS pages I read.',
    automation: VFS_AUTOMATION,
    whoBooks: 'The applicant or head of the family makes the VOW account; VOW then sends them to VFS to book. One appointment for each applicant.',
    evidence: [
      { label: 'Belgian Embassy: online visa application procedure', url: 'https://pakistan.diplomatie.belgium.be/en/travel-belgium/visa-belgium-and-grand-duchy-luxembourg/online-visa-application-procedure' },
      VFS_STATEMENT, VFS_TERMS,
    ],
    verified: 'Verified on an official page',
    verifiedNote: 'Provider and booking route are on the embassy page. The automation position rests on general VFS statements.',
    status: MANUAL_STATUS,
  },
  {
    country: 'France',
    provider: 'AEG — the service provider of the French Embassy in Islamabad; appointments are requested through AEG offices',
    officialUrl: 'https://france-visas.gouv.fr/en/pakistan',
    centres: 'Islamabad only. The Karachi consulate cannot receive applications.',
    advanceRelease: 'None published. The page only says to book well ahead, and group organisers to book through AEG at least a month before. Applications can be filed up to 6 months before departure.',
    integration: 'None found. The page offers phone and email contact only.',
    automation: 'Not offered. The page describes no online booking system to monitor — appointments are requested through AEG offices — and no permission for any tool.',
    whoBooks: 'Through an AEG office, once all documents are ready.',
    evidence: [{ label: 'France-Visas: Pakistan', url: 'https://france-visas.gouv.fr/en/pakistan' }],
    verified: 'Partly verified',
    verifiedNote: 'Read on the France-Visas page. AEG’s own website and its office list were not opened.',
    status: MANUAL_STATUS,
  },
  {
    country: 'Spain',
    provider: 'BLS Spain Visa Application Centre (BLS International)',
    officialUrl: 'https://pak.blsspainvisa.com/',
    centres: 'See the BLS Spain Pakistan site — it could not be opened from here.',
    advanceRelease: 'None found. The Pakistan site could not be opened. The UAE BLS Spain site has a News & Notification page but no alert or waiting-list feature.',
    integration: 'None found. BLS describes no API or partner access on the pages I read.',
    automation: 'Not permitted in practice. The BLS Spain UAE site says applicants must book their own appointments without third parties, and BLS says its live-person check has blocked over 700,000 bot bookings. Pakistan’s own rule must be confirmed in writing.',
    whoBooks: 'The applicant, in their own name (the UAE rule; Pakistan not yet confirmed).',
    evidence: [
      { label: 'BLS Spain (UAE) website and disclaimer', url: 'https://uae.blsspainvisa.com/' },
      { label: 'BLS International: liveness detection and fair access', url: 'https://blsinternational.com/insight/setting-the-standard-in-secure-citizen-services-how-bls-internationals-liveness-detection-implementation-strengthens-fair-access-and-system-integrity' },
      { label: 'BLS new system: CAPTCHA, SMS code, bot detection (Le360, Morocco)', url: 'https://en.le360.ma/society/schengen-visas-bls-international-rolls-out-new-system-to-end-appointment-chaos_ZENBSAHEJNDU7LJNCDEQKZXUB4/' },
    ],
    verified: 'Partly verified',
    verifiedNote: 'The Pakistan BLS Spain site did not open, so the rules above come from BLS’s UAE site and BLS statements.',
    status: MANUAL_STATUS,
  },
  {
    country: 'Switzerland',
    provider: 'VFS Global with Gerry’s International, per the VFS Switzerland page',
    officialUrl: 'https://visa.vfsglobal.com/one-pager/switzerland/pakistan/english/',
    centres: 'Not listed on the pages I could read.',
    advanceRelease: 'None found. The page only advises applying at least two weeks before travel, and earlier around holidays.',
    integration: 'None found.',
    automation: VFS_AUTOMATION,
    whoBooks: 'Not stated on the pages I could read.',
    evidence: [{ label: 'VFS Global: Switzerland in Pakistan', url: 'https://visa.vfsglobal.com/one-pager/switzerland/pakistan/english/' }, VFS_STATEMENT],
    verified: 'Partly verified',
    verifiedNote: 'Provider is on the VFS page. The Swiss embassy page I could open did not list the provider, centres or booking steps.',
    status: MANUAL_STATUS,
  },
  {
    country: 'Norway',
    provider: 'VFS Global with Gerry’s International',
    officialUrl: 'https://www.norway.no/en/pakistan/services-info/visitors-visa-res-permit/res-permit/handing-doc/',
    centres: 'Islamabad, Lahore, Karachi',
    advanceRelease: 'None published. The embassy page says waiting time for an appointment can be up to about 15 days. Visa work restarted on 24 March 2026.',
    integration: 'None found. No API, partner feed or alert service is described.',
    automation: VFS_AUTOMATION,
    whoBooks: 'Book online with VFS Global or through the VFS helpline; the appointment is needed before handing in documents.',
    evidence: [
      { label: 'Norway: handing in documents and booking', url: 'https://www.norway.no/en/pakistan/services-info/visitors-visa-res-permit/res-permit/handing-doc/' },
      { label: 'Norway: visa operations resumed (24 March 2026)', url: 'https://www.norway.no/en/pakistan/norway-pakistan/news-events/resuming-visa-operations-in-pakistan-24.03.2026/' },
      VFS_STATEMENT,
    ],
    verified: 'Verified on an official page',
    verifiedNote: 'Provider and booking route are on the Norway embassy page. The automation position rests on general VFS statements.',
    status: MANUAL_STATUS,
  },
];

export const providerRow = (country: string): ProviderRow | undefined => PROVIDER_TABLE.find(p => p.country === country);

/** Short provider name for alerts and cards. Falls back honestly for countries nobody has checked. */
export function providerName(country: string): string {
  const r = providerRow(country);
  if (!r) return 'Provider not checked yet';
  return r.provider.split(/ — |, reached| with Gerry| per the/)[0].trim();
}

// ---------------------------------------------------------------------------------------------
// Adapters. One per country, all behind the same shape, so a future approved feed can be added
// for one country without touching the rest of the engine.
// ---------------------------------------------------------------------------------------------
export type AdapterMode = 'manual' | 'official-feed';
export interface ProviderAdapter {
  country: string;
  mode: AdapterMode;
  /** true only when the provider has approved access in writing AND it has been tested */
  feedEnabled: boolean;
  /** what the adapter can report, and how */
  capabilities: { announcements: 'manual' | 'feed'; availability: 'manual' | 'feed'; cancellations: 'manual' | 'feed' };
  /** why it is in this mode */
  reason: string;
}

const NO_FEED = 'No approved feed, API or alert service exists for this provider, so people report what they see and the engine checks and files it.';

export const ADAPTERS: ProviderAdapter[] = FIVE_COUNTRIES.map(country => ({
  country, mode: 'manual', feedEnabled: false,
  capabilities: { announcements: 'manual', availability: 'manual', cancellations: 'manual' },
  reason: NO_FEED,
}));

export function adapterFor(country: string): ProviderAdapter {
  return ADAPTERS.find(a => a.country === country) || {
    country, mode: 'manual', feedEnabled: false,
    capabilities: { announcements: 'manual', availability: 'manual', cancellations: 'manual' },
    reason: 'This country has not been researched yet, so it runs in manual mode.',
  };
}
