import type { ReactElement } from 'react';

// One line-icon per screen, drawn the same way everywhere.
export const TILE_ICONS: Record<string, ReactElement> = {
  logout: <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />,
  money: <path d="M12 3v18M16.5 7.5C16.5 6 14.5 5 12 5S7.5 6.2 7.5 8s1.8 2.4 4.5 3 4.5 1.3 4.5 3.2S14.5 18 12 18s-4.5-1-4.5-2.5" strokeLinecap="round" strokeLinejoin="round" />,
  payouts: <path d="M12 21V8M7 13l5-5 5 5M4 4h16" strokeLinecap="round" strokeLinejoin="round" />,
  assistant: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" strokeLinecap="round" strokeLinejoin="round" />,
  myportal: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" strokeLinejoin="round" />,
  home: <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" strokeLinecap="round" strokeLinejoin="round" />,
  'grp-marketing': <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8M17 5a8 8 0 010 14" strokeLinecap="round" strokeLinejoin="round" />,
  'grp-cases': <path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />,
  'grp-hr': <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.5-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M16 20c0-2.5-1.5-4-3.5-4.5" strokeLinecap="round" strokeLinejoin="round" />,
  'grp-finance': <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M7 15h4" strokeLinecap="round" strokeLinejoin="round" />,
  'grp-quality': <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  coach: <path d="M12 3l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.4 7 18.2l1.2-5.6L4 8.8l5.6-.6L12 3z" strokeLinecap="round" strokeLinejoin="round" />,
  qc: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  dailyreport: <path d="M4 5h16v11H9l-5 4V5zM8 9.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  messages: <path d="M4 5h16v11H9l-5 4V5zM8 10h8M8 13h5" strokeLinecap="round" strokeLinejoin="round" />,
  grouptours: <path d="M21 16v-2l-8-5V4.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V18l-2.5 2v1.5l4-1 4 1V20l-2.5-2v-4.5l8 2.5z" strokeLinecap="round" strokeLinejoin="round" />,
  dashboard: <path d="M4 19V11M11 19V5M18 19V13" strokeLinecap="round" strokeLinejoin="round" />,
  leads: <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8" strokeLinecap="round" strokeLinejoin="round" />,
  leadsources: <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" strokeLinecap="round" strokeLinejoin="round" />,
  perfwatch: <path d="M12 3l8 3v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3zM12 8v5M12 16v.5" strokeLinecap="round" strokeLinejoin="round" />,
  adsmanager: <path d="M4 19V9M9 19V5M14 19v-7M19 19V8M3 19h18" strokeLinecap="round" strokeLinejoin="round" />,
  campaigns: <path d="M11 19l-2-9 9-4-4 9-9 2 6 2z M4 4l2 2M4 13h2M13 4v2" strokeLinecap="round" strokeLinejoin="round" />,
  testimonials: <path d="M7 15h2l2-4V7H5v4h3l-1 4zm8 0h2l2-4V7h-6v4h3l-1 4z" strokeLinecap="round" strokeLinejoin="round" />,
  cases: <path d="M3 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" strokeLinecap="round" strokeLinejoin="round" />,
  appointments: <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM8 13h2M14 13h2M8 17h2" strokeLinecap="round" strokeLinejoin="round" />,
  referralagents: <path d="M18 8a3 3 0 11-6 0 3 3 0 016 0zM6 8a3 3 0 106 0M2 19c0-2.8 2-5 5-5M13 19c0-2.5 1.8-4.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />,
  hr: <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.5-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M16 20c0-2.5-1.5-4-3.5-4.5" strokeLinecap="round" strokeLinejoin="round" />,
  attendance: <path d="M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" strokeLinecap="round" strokeLinejoin="round" />,
  accounts: <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M7 15h4" strokeLinecap="round" strokeLinejoin="round" />,
  reports: <path d="M4 19V11M11 19V5M18 19V13" strokeLinecap="round" strokeLinejoin="round" />,
  billing: <path d="M7 3h10a1 1 0 011 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 011-1zM9 8h6M9 12h6" strokeLinecap="round" strokeLinejoin="round" />,
  complaints: <path d="M12 4l9 16H3L12 4zM12 10v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />,
  clientdocs: <path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" strokeLinejoin="round" />,
  appraisal: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z" strokeLinecap="round" strokeLinejoin="round" />,
  announcements: <path d="M4 10v4h3l6 4V6L7 10H4zM16 9a4 4 0 010 6" strokeLinecap="round" strokeLinejoin="round" />,
  letters: <path d="M4 6h16v12H4V6zM4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />,
  payroll: <path d="M12 3v18M16.5 7.5C16.5 6 14.5 5 12 5S7.5 6.2 7.5 8s1.8 2.4 4.5 3 4.5 1.3 4.5 3.2S14.5 18 12 18s-4.5-1-4.5-2.5" strokeLinecap="round" strokeLinejoin="round" />,
  profit: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" strokeLinecap="round" strokeLinejoin="round" />,
  closing: <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  pricing: <path d="M9 5H5a1 1 0 00-1 1v4l9 9 5-5-9-9zM7 8h.01" strokeLinecap="round" strokeLinejoin="round" />,
};
export const DEFAULT_ICON = <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" strokeLinejoin="round" />;

export function Icon({ id, size = 18, stroke = 'currentColor', width = 1.8 }: { id: string; size?: number; stroke?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} className="flex-none" aria-hidden>
      {TILE_ICONS[id] || DEFAULT_ICON}
    </svg>
  );
}
