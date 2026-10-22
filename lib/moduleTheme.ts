// Every screen of the portal has its own colour, banner pattern and one-line promise,
// so you always know where you are at a glance. Everything is worked out from a
// single hue; the colour variables are set on the page wrapper and the whole
// screen (buttons, table heads, focus rings, cards) follows.

export type Pattern = 'dots' | 'lines' | 'waves' | 'grid' | 'rings' | 'diamonds' | 'plus' | 'chevrons';
export interface ModuleTheme {
  hue: number;
  sat?: number;           // 0-100, default 62
  pattern: Pattern;
  tagline: string;        // the one question this screen answers
  group: string;          // shown in the breadcrumb
}

const T = (hue: number, pattern: Pattern, group: string, tagline: string, sat = 62): ModuleTheme => ({ hue, sat, pattern, group, tagline });

export const THEMES: Record<string, ModuleTheme> = {
  hub:           T(222, 'rings',    'Home',             'Everything in one place — pick where you want to go', 55),
  dashboard:     T(224, 'grid',     'Home',             'How the business is doing right now', 50),
  dailyreport:   T(142, 'waves',    'Home',             'Your whole business in one WhatsApp message, every evening'),

  'grp-marketing': T(14, 'dots',    'Marketing',        'Leads, campaigns, and everything that brings clients in', 74),
  leads:         T(14,  'dots',     'Marketing',        'Every enquiry — who needs a reply today', 74),
  leadsources:   T(334, 'diamonds', 'Marketing',        'Where each lead came from, form by form', 66),
  coach:         T(80,  'chevrons', 'Marketing',        'What to do next with each lead — and a helper when you are stuck', 70),
  campaigns:     T(40,  'lines',    'Marketing',        'What each ad costs and what it brings', 88),
  adsmanager:    T(214, 'grid',     'Marketing',        'Your Meta ads — spend and leads, against the clients they brought', 78),
  testimonials:  T(304, 'plus',     'Marketing',        'Happy clients, in their own words', 56),

  'grp-cases':   T(221, 'lines',    'Cases & Clients',  'Visa files, appointments and partners', 70),
  cases:         T(221, 'lines',    'Cases & Clients',  'Every visa file, newest first — month by month', 70),
  appointments:  T(196, 'dots',     'Cases & Clients',  'Embassy dates and consultations coming up', 72),
  slotdesk:      T(62,  'chevrons', 'Cases & Clients',  'Who is waiting for a date, and when new dates open', 62),
  referralagents:T(252, 'diamonds', 'Cases & Clients',  'Partners who bring us clients — and what we owe them', 58),
  complaints:    T(350, 'plus',     'Cases & Clients',  'Problems raised by clients — solved and tracked', 66),
  clientdocs:    T(205, 'grid',     'Cases & Clients',  'Where every original document is right now', 40),
  pricing:       T(168, 'chevrons', 'Cases & Clients',  'What we charge, country by country', 60),
  grouptours:    T(186, 'waves',    'Cases & Clients',  'Package tours, travellers and QR verification', 78),

  'grp-hr':      T(266, 'dots',     'Team',             'Your people — records, attendance and pay', 56),
  hr:            T(266, 'dots',     'Team',             'Everyone on the team, their role and their requests', 56),
  perfwatch:     T(6,   'lines',    'Team',             'Who is falling behind — flagged automatically', 70),
  payroll:       T(146, 'plus',     'Team',             'Monthly pay, payslips and advances', 60),
  appraisal:     T(46,  'rings',    'Team',             'Targets, scorecards and top performers', 80),
  announcements: T(300, 'waves',    'Team',             'Notices every employee sees in their portal', 50),
  letters:       T(228, 'grid',     'Team',             'Experience, salary and appointment letters', 45),
  attendance:    T(174, 'dots',     'Team',             'Who is in, who is late, who is away', 70),

  'grp-finance': T(158, 'waves',    'Finance',          'Money in, money out, and what we keep', 66),
  money:         T(158, 'waves',    'Finance',          'Where the money stands — in plain words', 66),
  billing:       T(28,  'dots',     'Finance',          'Who owes us money, and when they will pay', 80),
  payouts:       T(352, 'lines',    'Finance',          'What we have to pay out, and when', 62),
  profit:        T(128, 'chevrons', 'Finance',          'What we kept this month, and whether we are growing', 58),
  closing:       T(238, 'grid',     'Finance',          'Lock the month and carry the balance forward', 52),
  accounts:      T(190, 'diamonds', 'Finance',          'Every entry, bank account and loan', 64),
  reports:       T(190, 'diamonds', 'Finance',          'Every entry, bank account and loan', 64),

  'grp-quality': T(172, 'plus',     'Quality & Team',   'Check files before they go out, talk to your team', 66),
  qc:            T(172, 'plus',     'Quality & Team',   'Nothing goes out with a missing step', 66),
  messages:      T(282, 'dots',     'Quality & Team',   'Private one-to-one chat with each team member', 52),

  myportal:      T(158, 'waves',    'My work',          'Your day, your leads, your cases and your earnings', 66),
  assistant:     T(262, 'rings',    'Assistant',        'Ask anything about leads, cases, visas or the portal', 60),
};

export const themeOf = (tab: string): ModuleTheme => THEMES[tab] || THEMES.hub;

const hsl = (h: number, s: number, l: number, a = 1) => (a === 1 ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`);

// The CSS variables for one screen. Applied as inline style on the wrapper.
export function themeVars(tab: string): Record<string, string> {
  const t = themeOf(tab); const h = t.hue; const s = t.sat ?? 62;
  return {
    '--accent': hsl(h, s, 38),
    '--accent-2': hsl((h + 22) % 360, Math.min(88, s + 8), 48),
    '--accent-ink': hsl(h, Math.max(30, s - 8), 20),
    '--accent-mid': hsl(h, s, 46),
    '--accent-soft': hsl(h, Math.min(90, s + 20), 96),
    '--accent-soft-2': hsl(h, Math.min(80, s + 10), 91),
    '--accent-line': hsl(h, Math.max(24, s - 24), 86),
    '--accent-glow': hsl(h, s, 50, 0.22),
    '--hero-a': hsl(h, s, 24),
    '--hero-b': hsl((h + 28) % 360, Math.min(80, s + 6), 40),
  };
}

// Banner decoration: a faint pattern drawn in white over the gradient.
export function patternImage(p: Pattern): string {
  const stroke = "stroke='white' stroke-opacity='0.16' fill='none' stroke-width='1.4'";
  const fill = "fill='white' fill-opacity='0.14'";
  const svg = (w: number, h: number, body: string) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;
  switch (p) {
    case 'dots': return svg(22, 22, `<circle cx='3' cy='3' r='1.6' ${fill}/>`);
    case 'lines': return svg(18, 18, `<path d='M-2 20L20 -2' ${stroke}/>`);
    case 'waves': return svg(60, 20, `<path d='M0 10 Q15 0 30 10 T60 10' ${stroke}/>`);
    case 'grid': return svg(26, 26, `<path d='M26 0H0V26' ${stroke}/>`);
    case 'rings': return svg(48, 48, `<circle cx='24' cy='24' r='16' ${stroke}/><circle cx='24' cy='24' r='7' ${stroke}/>`);
    case 'diamonds': return svg(30, 30, `<path d='M15 3L27 15L15 27L3 15Z' ${stroke}/>`);
    case 'plus': return svg(28, 28, `<path d='M14 8V20M8 14H20' ${stroke}/>`);
    case 'chevrons': return svg(28, 18, `<path d='M2 14L14 4L26 14' ${stroke}/>`);
  }
}
