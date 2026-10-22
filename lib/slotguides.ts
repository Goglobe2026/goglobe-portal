// "Where to book" — one card per country, written from the official embassy / provider pages and
// news reports read on 16 October 2026. Rules change often: the card says what was checked and where,
// and every card has the questions to put to the provider in writing.

export type GuideStatus = 'Checked on an official page' | 'Partly checked' | 'Not checked yet';
export interface GuideLink { label: string; url: string }
export interface SlotGuide {
  country: string;
  provider: string;
  centres: string;
  status: GuideStatus;
  steps: string[];
  rules: string[];
  ask: string[];
  links: GuideLink[];
  warning?: string;
}

export const GUIDES_CHECKED_ON = '16 October 2026';

const ASK_COMMON = [
  'Does a consultancy have a corporate or agent account, or an official way to book for clients?',
  'Is there an official waiting list or alert for when dates open?',
  'Are there premium or prime-time appointments, and how are they booked?',
];

export const SLOT_GUIDES: SlotGuide[] = [
  {
    country: 'Spain',
    provider: 'BLS Spain Visa Application Centre (BLS International)',
    centres: 'Check the BLS Spain Pakistan site for the centres — I could not open it from here.',
    status: 'Partly checked',
    warning: 'BLS Spain made booking self-service only in the UAE in July 2026. Find out in writing whether Pakistan has, or will have, the same rule before you promise clients anything.',
    steps: [
      'Book on the official BLS Spain website for Pakistan. Never through a third party that asks for money for the slot.',
      'In the UAE system the booking itself is free, is made by the applicant, and is tied to the passport number.',
      'Fees are paid when the application is submitted, at the official rates.',
    ],
    rules: [
      'UAE (reported 29 July 2026): bookings made through intermediaries are not accepted at the centre.',
      'UAE: appointments cannot be rescheduled — cancel and book again.',
      'UAE: security checks were added to block automated booking software.',
    ],
    ask: ['Does the UAE self-booking rule apply in Pakistan, and from what date?', 'May a consultancy sit with a client and guide them while they book in their own name?', ...ASK_COMMON],
    links: [
      { label: 'BLS Spain Pakistan — official site', url: 'https://pak.blsspainvisa.com/' },
      { label: 'BLS Spain Pakistan — notices', url: 'https://pak.blsspainvisa.com/news-notification.php' },
      { label: 'News: BLS Spain self-booking in the UAE (Khaleej Times)', url: 'https://www.khaleejtimes.com/life-and-living/visa-and-immigration-in-uae/bls-new-spain-self-book-visa-appointment-system-uae-residents' },
    ],
  },
  {
    country: 'Belgium',
    provider: 'VFS Global / Gerry’s International',
    centres: 'Islamabad, Lahore, Karachi',
    status: 'Checked on an official page',
    steps: [
      'The applicant (or head of the family) makes an account on Belgium’s Visa On Web (VOW) portal and fills in the short-stay form. The same account can be used for family members.',
      'VOW then sends the applicant to the VFS Global site to book the appointment. Book through VOW only — one appointment for each applicant.',
      'Print the form and go to the chosen centre with the documents. Visa and service fees are paid there; a live photo is taken, and fingerprints if needed.',
      'The embassy processes the file. Track it with the file number and “Islamabad” on the VFS tracking page.',
    ],
    rules: [
      'The online form is valid for 30 days. If the applicant has not been to the centre by then, the form is deleted — so fill it in only when a slot is close.',
      'Belgian officials have said payments to unauthorised intermediaries are wasted money.',
    ],
    ask: ['Can a consultancy keep one VOW account and prepare the forms for many families ahead of time?', ...ASK_COMMON],
    links: [
      { label: 'Belgian Embassy: online visa application procedure', url: 'https://pakistan.diplomatie.belgium.be/en/travel-belgium/visa-belgium-and-grand-duchy-luxembourg/online-visa-application-procedure' },
      { label: 'Belgian Embassy: VFS / Gerry’s centres', url: 'https://pakistan.diplomatie.belgium.be/en/travel-belgium/visa-belgium-and-grand-duchy-luxembourg/addresses-vfsgerrys-international-visa-drop-box' },
    ],
  },
  {
    country: 'Norway',
    provider: 'VFS Global / Gerry’s International',
    centres: 'Islamabad, Lahore, Karachi',
    status: 'Checked on an official page',
    steps: [
      'Book an appointment online with VFS Global (the “Attend a centre” page) or through the VFS helpline, and pay the service fee.',
      'You must have the appointment before you can hand in the application. Bring the passport and every document on the checklist.',
    ],
    rules: [
      'Norway’s visa work in Pakistan was closed for a time and restarted on 24 March 2026. Appointments between 3 and 25 March 2026 were rescheduled by VFS.',
      'The embassy page says waiting times for an appointment can be up to about 15 days.',
    ],
    ask: [...ASK_COMMON],
    links: [
      { label: 'Norway: handing in documents and booking', url: 'https://www.norway.no/en/pakistan/services-info/visitors-visa-res-permit/res-permit/handing-doc/' },
      { label: 'Norway: visa operations resumed (24 March 2026)', url: 'https://www.norway.no/en/pakistan/norway-pakistan/news-events/resuming-visa-operations-in-pakistan-24.03.2026/' },
    ],
  },
  {
    country: 'France',
    provider: 'AEG — service provider of the French Embassy in Islamabad',
    centres: 'Islamabad only. The Karachi consulate cannot receive applications.',
    status: 'Partly checked',
    warning: 'Read on the France-Visas page only. AEG’s own website and its office list were not opened — confirm the nearest AEG office and its opening days with them.',
    steps: [
      'Request the appointment through one of the AEG offices (open Monday to Saturday, shorter hours on Friday). There is no public online slot to watch.',
      'Ask for the appointment only when every document is ready.',
      'The interview and fingerprints are at the French Embassy in Islamabad. AEG also returns the passport.',
      'Group organisers are told to book through AEG at least a month ahead.',
    ],
    rules: [
      'Applications can be filed no more than 6 months before departure; processing averages about 15 days after the interview.',
      'AEG charges different rates for Islamabad and other offices — ask for the current tariff in writing.',
      'No release dates are published in advance.',
    ],
    ask: ['Which AEG offices take appointment requests, and on which days?', 'May a consultancy submit appointment requests for clients, and how is a group booked?', ...ASK_COMMON],
    links: [{ label: 'France-Visas: Pakistan', url: 'https://france-visas.gouv.fr/en/pakistan' }],
  },
  {
    country: 'Switzerland',
    provider: 'VFS Global with Gerry’s International',
    centres: 'Not listed on the pages I could read — confirm on the VFS Switzerland page.',
    status: 'Partly checked',
    warning: 'The provider comes from the VFS Switzerland page. The Swiss embassy page I could open did not list the centres, booking steps or fees, so confirm those with VFS before you promise anything.',
    steps: [
      'Short-stay (Schengen) applications are handed in through VFS Global. Long-stay applications and appeals against a refusal go to the Embassy of Switzerland in Islamabad.',
      'Book the appointment on the VFS Global Switzerland page for Pakistan, in the applicant’s name.',
      'Apply at least two weeks before travel, and earlier around holidays, because processing can take longer when it is busy.',
    ],
    rules: ['VFS only collects the documents — the embassy alone decides the visa and the time it takes.', 'No release dates are published in advance.'],
    ask: ['Which centres take Swiss short-stay applications, and how is the appointment booked?', 'May a consultancy sit with a client and guide them while they book in their own name?', ...ASK_COMMON],
    links: [{ label: 'VFS Global: Switzerland in Pakistan', url: 'https://visa.vfsglobal.com/one-pager/switzerland/pakistan/english/' }],
  },
  {
    country: 'Italy',
    provider: 'BLS (Italian visa application centres)',
    centres: 'Islamabad, Lahore, Multan, Faisalabad',
    status: 'Partly checked',
    warning: 'This comes from a news report of an Italian Embassy notice dated 26 July 2026, not from the embassy page itself. Confirm on the embassy’s own website.',
    steps: [
      'Short-stay appointments are booked only through the official portal named in the embassy notice.',
      'Family reunion and work visas have a waiting list — registered applicants are given appointments step by step.',
      'Students first finish pre-enrolment on the Universitaly portal; BLS then contacts them to book.',
    ],
    rules: ['The embassy calls paying anyone for an appointment fraud and asks for such offers to be reported.'],
    ask: [...ASK_COMMON],
    links: [{ label: 'News report of the Italian Embassy notice (ARY News)', url: 'https://arynews.tv/italy-visa-for-pakistanis-how-to-book-an-appointment-in-2026' }],
  },
  {
    country: 'Netherlands',
    provider: 'VFS Global',
    centres: 'Islamabad, Karachi, Lahore',
    status: 'Checked on an official page',
    steps: [
      'Book online with VFS Global Pakistan. A separate appointment is needed for each applicant.',
      'Apply up to 6 months before travel and at least 15 days before. Everyone attends in person, including children.',
      'To change or cancel, contact VFS Global Pakistan.',
    ],
    rules: ['The embassy page tells applicants not to use an intermediary for booking.'],
    ask: [...ASK_COMMON],
    links: [{ label: 'Netherlands: apply from Pakistan', url: 'https://www.netherlandsworldwide.nl/visa-the-netherlands/schengen-visa/apply-pakistan' }],
  },
];

/** Countries with no card yet — the card to fill in before the first client is promised a date. */
export const UNCHECKED_HOW_TO = [
  'Open the country’s embassy page for Pakistan and find who takes applications (embassy, VFS Global, BLS, TLScontact or another provider).',
  'Write down the centres, how the appointment is booked, and whether agents are allowed.',
  'Put the three standard questions to the provider in writing and keep the answers.',
];

export const guideFor = (country: string): SlotGuide | undefined => SLOT_GUIDES.find(g => g.country === country);
