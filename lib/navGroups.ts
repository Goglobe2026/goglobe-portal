// Maps the existing, unchanged module tabs into the grouped, drill-down
// navigation structure. Group ids are deliberately prefixed ("grp-...") so
// they never collide with the leaf tab ids they contain — "cases" the
// module and "grp-cases" the group hub are two different screens.

export type NavTile = { id: string; label: string; blurb: string };
export type NavGroup =
  | { id: string; label: string; standalone: true; blurb: string }
  | { id: string; label: string; standalone?: false; tiles: NavTile[]; blurb: string };

export const NAV_GROUPS: NavGroup[] = [
  { id: 'dashboard', label: 'Dashboard', standalone: true, blurb: 'Business status across every country, at a glance' },
  {
    id: 'grp-marketing', label: 'Marketing', blurb: 'Leads, campaigns, and everything that brings clients in',
    tiles: [
      { id: 'leads', label: 'Leads', blurb: 'Every enquiry, from first message to conversion' },
      { id: 'campaigns', label: 'Campaigns', blurb: 'Ad performance, cost per lead and per conversion' },
      { id: 'testimonials', label: 'Success Stories', blurb: 'Approved cases and client testimonials' },
    ],
  },
  {
    id: 'grp-cases', label: 'Cases & Clients', blurb: 'Active visa cases, appointments, and referral partners',
    tiles: [
      { id: 'cases', label: 'Cases', blurb: 'Active and closed visa applications' },
      { id: 'appointments', label: 'Appointments', blurb: 'Embassy dates, consultations, document collection' },
      { id: 'referralagents', label: 'Referral Agents', blurb: 'External partners and their commissions' },
    ],
  },
  { id: 'grouptours', label: 'Group Tours', standalone: true, blurb: 'Package tour registrations and QR verification' },
  {
    id: 'grp-hr', label: 'HR', blurb: 'Your team — records, attendance, and requests',
    tiles: [
      { id: 'hr', label: 'HR Department', blurb: 'Employee records, roles, contracts, performance' },
      { id: 'attendance', label: 'Attendance', blurb: 'Check-in, check-out and duty timings, tracked daily' },
    ],
  },
  {
    id: 'grp-finance', label: 'Finance', blurb: 'Money in, money out, and what things cost',
    tiles: [
      { id: 'accounts', label: 'Accounts', blurb: 'Ledger, outstanding balances, bank accounts' },
      { id: 'reports', label: 'Reports & Finance', blurb: 'Performance charts, loans, revenue targets' },
      { id: 'pricing', label: 'Pricing by Country', blurb: 'Consultation, visa service, and appointment fees' },
    ],
  },
];

// Given any leaf tab id (e.g. "leads"), finds which group it lives under —
// used both for the sidebar's "back to..." link and for highlighting the
// right group as active while you're inside one of its tiles.
export function findGroupForTab(tabId: string): NavGroup | null {
  for (const g of NAV_GROUPS) {
    if (g.id === tabId) return g;
    if (!g.standalone && g.tiles.some(t => t.id === tabId)) return g;
  }
  return null;
}

export function isGroupHub(id: string): boolean {
  return NAV_GROUPS.some(g => g.id === id && !g.standalone);
}
