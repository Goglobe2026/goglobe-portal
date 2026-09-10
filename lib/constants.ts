export const DESTINATIONS = [
  'UK', 'USA', 'Canada', 'Australia', 'Schengen', 'Türkiye',
  'New Zealand', 'UAE', 'Malaysia', 'Saudi Arabia', 'Azerbaijan', 'Morocco',
] as const;

export const REGION_COUNTRIES: Record<string, string[]> = {
  'Europe': ['UK', 'Schengen', 'Türkiye'],
  'Middle East': ['UAE', 'Saudi Arabia', 'Azerbaijan'],
  'North America': ['USA', 'Canada'],
  'Oceania': ['Australia', 'New Zealand'],
  'Asia': ['Malaysia'],
  'Africa': ['Morocco'],
};
export const REGIONS = Object.keys(REGION_COUNTRIES);

export const VISA_TYPES_BY_DEST: Record<string, string[]> = {
  Canada: ['Tourist', 'Business'],
  UAE: ['Tourist', 'Business'],
  Australia: ['Tourist', 'Business'],
  Malaysia: ['Tourist', 'Business'],
};

export function visaTypesFor(dest: string): string[] {
  return VISA_TYPES_BY_DEST[dest] || ['Tourist'];
}

export const JOB_DESCRIPTIONS: Record<string, string> = {
  Sales: 'Handle inbound leads end-to-end: qualify enquiries, guide clients through document collection, log every WhatsApp/call touchpoint, hit monthly closing targets, and hand off completed files to the manager for review.',
  Management: 'Review compiled case files and cover letters, approve or send back cases for correction, oversee appointment booking, and monitor overall pipeline health across the team.',
  Documentation: 'Verify client documents against the country-specific checklist, flag missing or incorrect paperwork, and confirm every file is complete before it goes to manager review.',
  Marketing: 'Plan and run ad campaigns, track cost-per-lead and cost-per-close, and coordinate with sales on lead quality and volume.',
  Accounts: 'Record payments across consultation, visa and appointment fees, reconcile the ledger, chase outstanding balances, and process payroll, commission and bonus runs.',
  Admin: 'Manage front-desk operations, greet walk-in clients, coordinate scheduling logistics, and support day-to-day office administration.',
};

export const DOC_TEMPLATES: Record<string, string[]> = {
  'UK|Tourist': ['Valid passport (6+ months, blank pages)', 'GWF online application confirmation', 'Passport-size photographs', 'Bank statements (6 months)', 'Employment letter / business proof', 'Proof of accommodation', 'Travel itinerary', 'Travel insurance', 'Evidence of ties to home country', 'Visa fee payment receipt', 'Invitation letter (if visiting family/friends)'],
  'Schengen|Tourist': ['Valid passport (3+ months beyond return, 2 blank pages)', 'Completed & signed application form', 'Biometric photographs (35x45mm)', 'Travel insurance (min. €30,000 cover)', 'Flight reservation', 'Hotel / accommodation booking', 'Bank statements (3 months)', 'Cover letter', 'Employment / business proof', 'Civil status documents (if applicable)'],
  'Canada|Business': ['Valid passport', 'Passport-size photographs', 'Bank statements (6 months)', 'Employer NOC letter', 'Invitation letter from host company', 'Company registration / trade license', 'Proof of funds', 'Travel history (old passports/visas)', 'Cover letter'],
  'Canada|Tourist': ['Valid passport', 'Passport-size photographs', 'Bank statements (6 months)', 'Employer NOC letter', 'Proof of funds', 'Travel itinerary', 'Cover letter'],
  'UAE|Business': ['Valid passport (6+ months)', 'Passport-size photographs', 'Invitation letter from UAE company', 'Bank statements (3 months)', 'Trade license / company documents', 'Cover letter'],
  'UAE|Tourist': ['Valid passport (6+ months)', 'Passport-size photographs', 'Bank statements (3 months)', 'Hotel booking', 'Cover letter'],
  'USA|Tourist': ['Valid passport (6+ months beyond stay)', 'DS-160 confirmation page', 'Visa fee payment receipt', 'Passport-size photograph', 'Bank statements (6 months)', 'Employment letter', 'Property / business ownership proof (if any)', 'Travel itinerary', 'Cover letter'],
  'Türkiye|Tourist': ['Valid passport (6+ months)', 'Passport-size photographs', 'Bank statements (3 months)', 'Hotel booking', 'Flight reservation', 'Cover letter'],
  'Australia|Tourist': ['Valid passport (6+ months)', 'Subclass 600 online application', 'Passport-size photographs', 'Bank statements (6 months) / proof of funds', 'Employment leave letter', 'Travel itinerary', 'Cover letter'],
  'Australia|Business': ['Valid passport (6+ months)', 'Subclass 600 (business stream) application', 'Invitation letter from Australian company', 'Company registration documents', 'Bank statements (6 months)', 'Employer NOC letter', 'Cover letter'],
  'New Zealand|Tourist': ['Valid passport (6+ months)', 'Online visitor visa application', 'Passport-size photographs', 'Proof of onward/return ticket', 'Bank statements — min. NZD 1,000/month (or sponsor letter)', 'Employment leave letter', 'Cover letter'],
  'Malaysia|Tourist': ['Valid passport (6+ months)', 'Passport-size photographs', 'Bank statements (3 months)', 'Hotel booking', 'Return flight ticket', 'Cover letter'],
  'Malaysia|Business': ['Valid passport (6+ months)', 'Passport-size photographs', 'Invitation letter from Malaysian company', 'Bank statements (3 months)', 'Trade license / company documents', 'Cover letter'],
  'Saudi Arabia|Tourist': ['Valid passport (6+ months)', 'eVisa online application', 'Passport-size photographs', 'Proof of accommodation', 'Bank statements (3 months)', 'Return flight ticket', 'Cover letter'],
  'Azerbaijan|Tourist': ['Valid passport (6+ months)', 'ASAN e-Visa online application', 'Passport-size photographs', 'Bank statements (3 months)', 'Hotel booking', 'Return flight ticket', 'Cover letter'],
  'Morocco|Tourist': ['Valid passport (6+ months)', 'Passport-size photographs', 'Bank statements (3 months)', 'Hotel booking', 'Return flight ticket', 'Cover letter'],
  default: ['Valid passport (6+ months)', 'Passport-size photographs', 'Bank statements', 'Cover letter'],
};

export function getDocTemplate(destination: string, visaType: string) {
  const list = DOC_TEMPLATES[`${destination}|${visaType}`] || DOC_TEMPLATES.default;
  return list.map((name, i) => ({ id: genId('dc'), name, order: i + 1, status: 'Pending' as const }));
}

export const DEFAULT_RATES: Record<string, [number, number]> = {
  'UK|Tourist': [95000, 6000], 'Schengen|Tourist': [85000, 5000], 'Canada|Tourist': [70000, 4000], 'Canada|Business': [90000, 5000],
  'UAE|Tourist': [35000, 2000], 'UAE|Business': [45000, 3000], 'USA|Tourist': [100000, 6000], 'Türkiye|Tourist': [38000, 2000],
  'Australia|Tourist': [80000, 5000], 'Australia|Business': [95000, 5500], 'New Zealand|Tourist': [75000, 4500],
  'Malaysia|Tourist': [30000, 2000], 'Malaysia|Business': [40000, 2500], 'Saudi Arabia|Tourist': [25000, 1500],
  'Azerbaijan|Tourist': [28000, 1500], 'Morocco|Tourist': [40000, 2000],
};

export const CASE_STAGES = ['Assessment', 'Documents', 'Manager Review', 'Appointment Booking', 'Submitted', 'Interview', 'Decision'] as const;
export const CASE_STATUSES = ['Active', 'Approved', 'Refused', 'Closed'] as const;
export const LEAD_STAGES = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'] as const;
export const APPT_STATUSES = ['Watching for slot', 'Scheduled', 'Completed', 'Missed'] as const;
export const DEPARTMENTS = ['Sales', 'Management', 'Documentation', 'Accounts', 'Marketing', 'Admin'] as const;

export function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function money(n: number) {
  return 'PKR ' + Math.round(n || 0).toLocaleString();
}

export function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function today() {
  // Explicitly Pakistan time, not server-local or browser-local — this
  // business operates in one timezone, and getting this wrong meant any
  // action taken late at night (roughly 8pm-5am PKT) got stamped with
  // yesterday's date instead of today's.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}
