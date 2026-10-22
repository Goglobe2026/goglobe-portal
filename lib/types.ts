export interface Lead {
  id: string;
  name: string;
  phone: string;
  source: string;
  campaign: string;
  destination: string;
  visaType: string;
  stage: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  assignedTo: string;
  createdAt: string;
  notes: string;
  messages: { date: string; text: string; direction: 'In' | 'Out'; responded?: 'Yes' | 'No' | null }[];
  nextFollowUp: string;
  lastContacted: string;
  escalated: boolean;
  escalationReason: string;
  escalationResolved: boolean;
  lostReason: string;
  interestLevel: 'High' | 'Medium' | 'Low' | 'Unrated';
  isVip: boolean;
  occupation: string;
  lastEngagementSent: string;
  // The Facebook lead id from the sheet (e.g. "l:961953543161253") — stops the same lead being added twice.
  externalId?: string;
  // The exact moment the lead came in (ISO time). `createdAt` is only the day.
  // Newest-first lists and the "NEW" highlight use this when it is there.
  receivedAt?: string;
  city?: string;
  // Which lead source (ad form link) brought this lead in, and what the person
  // answered on that form, question by question.
  sourceId?: string;
  answers?: Record<string, string>;
}

// One ad form's lead sheet. Every Facebook / Instagram instant form has its
// own questions, so each form (UK, Schengen, Canada…) gets its own source,
// tied to a country and a campaign, and its leads are counted separately.
export interface LeadSource {
  id: string;
  name: string;            // "UK visitor visa form"
  country: string;         // destination its leads are filed under ('' = take it from the sheet)
  campaign: string;        // portal campaign its leads belong to ('' = take it from the sheet)
  url: string;             // Google Sheet link (shared as "Anyone with the link")
  active: boolean;         // paused sources are skipped by every sync
  sinceDays: number;       // first sync brings in this many days back (0 = everything)
  createdAt: string;
}

export interface DocItem {
  id: string;
  name: string;
  order: number;
  status: 'Pending' | 'Received' | 'Verified';
}

// One extra applicant on a family / group file. The head of the family is
// the case itself (`Case.name`); everyone else is listed here.
export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  passportNo?: string;
  age?: string;
}

// A bonus attached to one case: pick an employee, enter an amount. It is
// paid through Payroll (as its own line on the payslip) and then marked paid.
export interface CaseBonus {
  id: string;
  staffId: string;
  amount: number;
  note: string;
  month: string;        // payroll month it should be paid in (YYYY-MM)
  paid: boolean;
  paidDate?: string;
  paidRunMonth?: string;
}

export interface Case {
  id: string;
  referenceCode: string;
  name: string;
  phone: string;
  destination: string;
  visaType: string;
  consultant: string;
  caseStage: 'Assessment' | 'Documents' | 'Manager Review' | 'Appointment Booking' | 'Submitted' | 'Interview' | 'Decision';
  status: 'Active' | 'Approved' | 'Refused' | 'Closed';
  fee: number;
  paid: number;
  apptFee: number;
  apptPaid: number;
  consultFee: number;
  consultPaid: number;
  discount: number;
  discountReason: string;
  costToExecute: number;
  referralAgentId: string;
  referralCommissionPercent: number;
  referralCommissionPaid: number;
  createdAt: string;
  documents: DocItem[];
  coverLetterChecked: boolean;
  managerApproved: boolean;
  caseType: string;
  expectedPaymentDate?: string;
  lastReminderDate?: string;
  reminderCount?: number;
  // Family / group file: extra applicants besides the head of family.
  familyMembers?: FamilyMember[];
  // Who closed the deal and on what date. Counts in that employee's
  // performance and payroll for that month. Missing = the consultant /
  // created date (older cases); '' = not closed yet.
  closedBy?: string;
  closedDate?: string;
  caseBonuses?: CaseBonus[];
  // How the client will pay: e.g. half now and half at the appointment. Money
  // received on the file always fills the oldest unpaid part first. Missing =
  // no plan (one balance, with the optional promised date above).
  plan?: PlanPart[];
  // Sequential query number (GG01, GG02, …) given to every case, in the order the
  // cases were entered. Given by the server if a browser did not.
  queryNo?: string;
  // The query number of the existing client who recommended this one (if any).
  referredByQueryNo?: string;
  // Money that leaves our account on behalf of this client (embassy / appointment
  // fee, courier…). Each one is added to Expenses by itself on its date.
  outlays?: CaseOutlay[];
  // The group tour this client (and the family) was added to from the case form.
  tourId?: string;
}

// One payout for a client file. It becomes an expense of category "Embassy fees"
// (or the category chosen) on its date; `posted` says that has happened.
export interface CaseOutlay {
  id: string;
  label: string;           // "Appointment / embassy fee"
  amount: number;          // PKR that actually leaves the account
  date: string;            // YYYY-MM-DD it is (or was) paid
  category?: string;       // expense category, default "Embassy fees"
  currency?: string;       // when it was paid in another currency (GBP, EUR…)
  foreignAmount?: number;
  rate?: number;           // PKR for one unit of that currency, incl. bank charges
  posted?: boolean;
  txId?: string;
  note?: string;
}

// What makes a part of the fee fall due.
export type PlanTrigger = 'now' | 'date' | 'appointment' | 'collection' | 'decision';
export interface PlanPart {
  id: string;
  label: string;          // "Advance", "At appointment"…
  amount: number;         // PKR
  trigger: PlanTrigger;
  dueDate?: string;       // YYYY-MM-DD: the date for 'date' parts; for the others, the date once it is known
}

export interface ReferralAgent {
  id: string;
  name: string;
  phone: string;
  defaultCommissionPercent: number;
  notes: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Slot Desk — Head Manager and admins only. Nothing here connects to any visa website.
// ---------------------------------------------------------------------------
export type SlotHow = '' | 'Client booked, we guided' | 'Our team on the official site' | 'Paid middleman' | 'Other';
export interface SlotRequest {
  id: string; clientName: string; phone: string; caseId: string; apptId: string;
  country: string; centre: string; applicants: number;
  travelBy: string;                                   // YYYY-MM-DD or ''
  priority: 'Urgent' | 'Normal' | 'Flexible';
  status: 'Waiting' | 'Booked' | 'Cancelled';
  slotDate: string; slotTime: string;
  bookedHow: SlotHow;
  middleman: string; premium: number;                 // extra PKR paid to a middleman (0 if none)
  assignedTo: string;                                 // team member id
  note: string; createdAt: string; bookedAt: string;
  details?: string;                                   // what the booking form asks for, one per line (e.g. "Passport no: AB1234567")
  live?: SlotLive;                                    // where this client is on the live booking board ('' = ready)
  liveBy?: string;                                    // who is looking after them right now (name)
  visaType?: string;                                  // Tourist, Business, Family / friends visit …
  purpose?: string;                                   // one line: why they travel
  dateFrom?: string; dateTo?: string;                 // the appointment dates the client can accept (YYYY-MM-DD)
  confirmationRef?: string;                           // the official confirmation / reference number, once booked
  ready?: string[];                                   // readiness checklist items that are ticked
}
export type SlotLive = '' | 'Calling' | 'Booking' | 'No slot';
export interface SlotRelease {
  id: string; country: string; centre: string; label: string;
  time: string;                                       // HH:MM, Pakistan time
  days: number[];                                     // 0 = Sunday … 6 = Saturday (repeats weekly)
  oneOffDate: string;                                 // YYYY-MM-DD: a single opening instead of a weekly one
  rota: string[];                                     // team member ids who are on duty at that time
  note: string; active: boolean;
  basis?: 'Official notice' | 'Our estimate';         // an announced time, or our own guess (old entries count as a guess)
  sourceUrl?: string;                                 // link to the official page that announced it
}
export interface SlotAttempt {
  id: string; releaseId: string; date: string;
  outcome: 'Got slots' | 'Not open' | 'Missed'; slotsGot: number; by: string; note: string;
  time?: string;                                      // HH:MM Pakistan time when it was checked / dates appeared
}

// ---- early-warning: alerts, the notification log, the audit trail and per-country settings ----
export type AlertCategory =
  | 'OFFICIAL RELEASE ANNOUNCED'
  | 'OFFICIALLY CONFIRMED FUTURE RELEASE'
  | 'APPOINTMENT AVAILABILITY OBSERVED'
  | 'CANCELLATION AVAILABILITY OBSERVED'
  | 'MANUAL VERIFICATION REQUIRED'
  | 'PROVIDER SOURCE UNAVAILABLE';
export type AlertVerification = 'Official notice' | 'Seen by staff' | 'Reported by client' | 'Unverified';
export interface SlotAlert {
  id: string; category: AlertCategory;
  country: string; centre: string; provider: string;
  at: string;                                         // ISO time it was announced / observed (real UTC time)
  source: string; sourceUrl: string;                  // where it came from, and the link to it
  verification: AlertVerification;
  opensDate: string; opensTime: string;               // only for a confirmed future release (Pakistan time)
  note: string; loggedBy: string;
  handled: boolean; handledBy?: string; handledAt?: string;
}
export interface SlotNotice {
  id: string; alertId: string; topic: string;         // what the message was about (an alert, or country+centre+hour)
  to: string; toName: string;                         // team member id and name
  channel: 'WhatsApp' | 'Copied';
  status: 'Opened' | 'Sent' | 'Failed';               // "Opened" = the WhatsApp window was opened; staff confirm Sent or Failed
  attempt: number; at: string; by: string;
}
export interface SlotAudit {
  id: string; at: string; by: string;
  area: 'Case' | 'Alert' | 'Release' | 'Result' | 'Notice' | 'Source' | 'Settings' | 'Data';
  action: string; country: string; ref: string; detail: string;
}
export interface SlotConfig {
  id: string; country: string;                        // one record per country; id = country
  officialUrl: string;                                // the official notices / booking page the team checks
  checkEveryHours: number;                            // how often someone must look at it
  notify: string[];                                   // team member ids who are alerted first for this country
  enabled: boolean;
  lastCheckedAt: string; lastCheckedBy: string;
}

export interface GroupTour {
  id: string;
  tourCode: string;
  name: string;
  region: string;
  destination: string;
  startDate: string;
  endDate: string;
  capacity: number;
  packagePrice: number;
  status: 'Open' | 'Limited Seats' | 'Full' | 'Closed';
  description: string;
  includedServices: string[];
  planPdf: string;
  planPdfName: string;
  createdAt: string;
}

export interface TourMember {
  id: string;
  tourId: string;
  referenceCode: string;
  name: string;
  fatherName: string;
  phone: string;
  whatsapp: string;
  email: string;
  cnic: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  emergencyContact: string;
  address: string;
  paid: number;
  totalDue: number;
  status: 'Registered' | 'Partially Paid' | 'Fully Paid' | 'Documentation Complete' | 'Travel Confirmed' | 'Cancelled';
  bookingDate: string;
  // Set when the traveler was added from a visa case / family file: the case, the
  // head of that family, and how many travel together (so a family shows as one group).
  caseId?: string;
  familyHead?: string;
  familySize?: number;
}

export interface CountryNote {
  id: string;
  country: string;
  note: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  direction: 'Given' | 'Taken';
  party: string;
  principal: number;
  interestPercent: number;
  startDate: string;
  amountRepaid: number;
  status: 'Active' | 'Paid Off';
  notes: string;
}

export interface ClientFeedback {
  id: string;
  caseReferenceCode: string;
  clientName: string;
  consultantId: string;
  rating: number;
  wouldRecommend: boolean;
  moneyDemanded: boolean;
  moneyDemandedDetails: string;
  comment: string;
  submittedAt: string;
  reviewedByCeo: boolean;
}

export interface MarketingMaterial {
  id: string;
  name: string;
  pdf: string;
  pdfName: string;
  uploadedAt: string;
}

export interface FollowUpTemplate {
  id: string;
  followUpNumber: number;
  message: string;
  daysUntilNext: number;
}

export interface PayrollCategory {
  id: string;
  name: string;
  kind: 'Earning' | 'Deduction';
  mode: 'Fixed' | 'Variable';
  posting: 'Salary' | 'Commission' | 'Bonus' | 'Appreciation';
  active: boolean;
  builtin?: boolean;
}

export interface PayLineItem {
  categoryId: string;
  label: string;
  kind: 'Earning' | 'Deduction';
  amount: number;
  posting: string;
  auto: boolean;
  fullAmount?: number;   // full-month amount when this item is pro-rated by payable days
  refs?: string[];       // ids of case bonuses included in this item
  note?: string;         // small explanation printed under the item on the payslip
}

// How many days of the month the employee is paid for (joining / leaving).
export interface PayProRata {
  workingDays: number;
  payableDays: number;
  from: string;
  to: string;
  note: string;
}

export interface PayAttendance {
  workingDays: number;
  elapsedDays: number;
  present: number;
  leave: number;
  absent: number;
  suggestedDeduction: number;
}

export interface PayrollLine {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  employeeId: string;
  department: string;
  bankName: string;
  accountNo: string;
  items: PayLineItem[];
  attendance: PayAttendance;
  proRata?: PayProRata;
  notes?: string[];      // things the person running payroll should know (not printed)
  slipNumber: string;
  paid: boolean;
  paidDate: string;
}

export interface PayRun {
  id: string;
  month: string;
  dueDate?: string;
  status: 'Draft' | 'Approved' | 'Paid';
  createdDate: string;
  approvedDate: string;
  paidDate: string;
  lines: PayrollLine[];
}

export interface StaffAdvance {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  amount: number;
  monthlyRecovery: number;
  recovered: number;
  reason: string;
}

export interface Complaint {
  id: string; date: string; clientName: string; phone: string; caseId: string; category: string;
  severity: 'Low' | 'Medium' | 'High'; description: string; assignedTo: string;
  status: 'Open' | 'In progress' | 'Escalated' | 'Resolved'; resolution: string; resolvedDate: string;
}
export interface StaffTarget { id: string; staffId: string; month: string; casesTarget: number; revenueTarget: number; }
export interface Appraisal { id: string; staffId: string; month: string; rating: number; comments: string; score: number; savedDate: string; }
export interface Announcement { id: string; date: string; title: string; body: string; audience: string; pinned: boolean; createdBy: string; }
export interface DocRecord {
  id: string; refNo: string; date: string; clientName: string; phone: string; caseId: string; docType: string; description: string;
  isOriginal: boolean; receivedBy: string; status: 'With us' | 'Submitted to embassy' | 'Returned to client'; statusDate: string; notes: string;
}
export interface Letter { id: string; refNo: string; staffId: string; staffName: string; type: string; date: string; body: string; }

export interface MonthlyClosing {
  id: string;
  month: string;
  openingBalance: number;
  collections: number;
  otherIncome: number;
  salaries: number;
  commissionsBonuses: number;
  otherExpenses: number;
  expectedClosing: number;
  actualClosing: number | null;
  carriedBalance: number;
  carriedForwardPending: number;
  bookedValue: number;
  note: string;
  closedDate: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  caseId: string;
  date: string;
  clientName: string;
  clientPhone: string;
  clientCity: string;
  visaType: string;
  destination: string;
  serviceDescription: string;
  totalAmount: number;
  advancePercent: number;
  advanceAmount: number;
  advanceStatus: 'Due' | 'Paid';
  advancePaidDate: string;
  advancePaymentMethod: string;
  balanceAmount: number;
  balanceStatus: 'Pending' | 'Paid';
  balancePaidDate: string;
  balanceDueDate: string;
  clientAcknowledged: boolean;
  clientAcknowledgedDate: string;
}

export interface PersonalExpense {
  id: string;
  date: string;
  person: string;
  amount: number;
  category: string;
  note: string;
}

export interface Appointment {
  id: string;
  clientName: string;
  phone: string;
  date: string;
  time: string;
  type: string;
  portal: string;
  consultant: string;
  status: 'Watching for slot' | 'Scheduled' | 'Completed' | 'Missed';
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: 'Sales' | 'Management' | 'Documentation' | 'Accounts' | 'Marketing' | 'Admin';
  employeeId: string;
  pin: string;
  phone: string;
  email: string;
  shiftStart: string;
  shiftEnd: string;
  salary: number;
  commissionPercent: number;
  bonusPerClose: number;
  lastSalaryPaid: string;
  jobDescription: string;
  education: string;
  experience: string;
  contractType: 'Permanent' | 'Contract' | 'Probation' | 'Part-time';
  contractStart: string;
  contractEnd: string;
  monthlyQuota: number;
  performanceCategory: 'Junior' | 'Standard' | 'Senior' | 'Top Performer';
  employmentStatus: 'Active' | 'On Leave' | 'Resigned' | 'Terminated';
  lastWorkingDay: string;
  monthlyAllowance: number;
  guardianName: string;
  guardianPhone: string;
  address: string;
  contractPdf: string;
  contractPdfName: string;
  isAdmin: boolean;
  // Can open Slot Desk (and My Portal) and nothing else. Much narrower than isAdmin: no money, no pay, no other staff's records.
  slotDesk?: boolean;
  bankName?: string;
  accountNo?: string;
  payItems?: { categoryId: string; amount: number }[];
  // Countries this person is an expert in. Empty / missing = handles everything.
  specialties?: Specialty[];
}

export type Specialty = 'UK' | 'Europe' | 'Australia, US & Canada';

export interface Transaction {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  party: string;
  amount: number;
  note: string;
  caseId?: string;
  // Set when this expense was posted automatically from a campaign payment.
  campaignId?: string;
  adSpendId?: string;
}

// One payment to an ad platform. Paid in dollars (USD) with the rate and the
// tax/bank charges added on top, or paid directly in rupees. `pkr` is what it
// really cost in rupees and is what goes into the books.
export interface AdSpend {
  id: string;
  date: string;
  currency: 'USD' | 'PKR';
  usd?: number;
  rate?: number;
  taxPct?: number;
  pkr: number;
  note?: string;
  txId: string; // the expense entry this payment created in Accounts
}

export interface Campaign {
  id: string;
  name: string;
  platform: string;
  // Spend entered before payments were logged here (not in the books).
  spend: number;
  startDate: string;
  // Missing = Running (older campaigns).
  status?: 'Running' | 'Paused' | 'Closed';
  endDate?: string;
  monthlyBudget?: number; // PKR per month
  budgetUsd?: number;     // the same budget in dollars, when it was set in dollars
  budgetRate?: number;    // PKR per $1 and tax % used for that budget (pre-fill for payments)
  budgetTaxPct?: number;
  // The campaign's name in Facebook Ads Manager, if different — leads from the
  // sheet carry that name, so this is how they are matched to the campaign.
  fbName?: string;
  spends?: AdSpend[];
  autoCreated?: boolean;
  closeNote?: string;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  onApprovedLeave: boolean;
}

export interface RateCardEntry {
  id: string;
  destination: string;
  visaType: string;
  consultFee: number;
  visaFee: number;
  apptFee: number;
}

export interface Adjustment {
  id: string;
  staffId: string;
  type: 'Bonus' | 'Fine';
  amount: number;
  reason: string;
  date: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  balance: number;
}

export interface JournalVoucher {
  id: string;
  date: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  narration: string;
}

export interface EmployeeRequest {
  id: string;
  staffId: string;
  type: 'Leave' | 'Salary advance' | 'Complaint' | 'Other';
  details: string;
  date: string;
  leaveStartDate: string;
  leaveEndDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  managerNote: string;
}

export interface ActivityItem {
  t: string;
  at: string;
}

export interface Testimonial {
  id: string;
  caseId: string;
  clientName: string;
  destination: string;
  visaType: string;
  quote: string;
  rating: number;
  consentGiven: boolean;
  featured: boolean;
  createdAt: string;
}

export type Collections = {
  leads: Lead[];
  cases: Case[];
  appointments: Appointment[];
  team: TeamMember[];
  transactions: Transaction[];
  campaigns: Campaign[];
  attendance: AttendanceRecord[];
  ratecard: RateCardEntry[];
  adjustments: Adjustment[];
  bankaccounts: BankAccount[];
  journalvouchers: JournalVoucher[];
  requests: EmployeeRequest[];
  activity: ActivityItem[];
  testimonials: Testimonial[];
  referralagents: ReferralAgent[];
  grouptours: GroupTour[];
  tourmembers: TourMember[];
  countrynotes: CountryNote[];
  loans: Loan[];
  personalexpenses: PersonalExpense[];
  clientfeedback: ClientFeedback[];
  marketingmaterials: MarketingMaterial[];
  followuptemplates: FollowUpTemplate[];
  invoices: Invoice[];
  monthlyclosings: MonthlyClosing[];
  payrollcategories: PayrollCategory[];
  payruns: PayRun[];
  staffadvances: StaffAdvance[];
  complaints: Complaint[];
  stafftargets: StaffTarget[];
  appraisals: Appraisal[];
  announcements: Announcement[];
  docregister: DocRecord[];
  letters: Letter[];
  qcchecks: QcCheck[];
  messages: TeamMessage[];
  leadsources: LeadSource[];
  slotwaiting: SlotRequest[];
  slotreleases: SlotRelease[];
  slotlog: SlotAttempt[];
  slotalerts: SlotAlert[];
  slotnotices: SlotNotice[];
  slotaudit: SlotAudit[];
  slotconfig: SlotConfig[];
};

export type CollectionName = keyof Collections;

export type Session = { type: 'ceo' } | { type: 'employee'; staffId: string };


// One quality check of a case file before it goes out. Newest check wins.
export interface QcItem { id: string; label: string; ok: boolean; note?: string }
export interface QcCheck {
  id: string;
  caseId: string;
  date: string;            // YYYY-MM-DD
  at: string;              // ISO time it was saved (orders checks on the same day)
  reviewerId: string;      // team member id, or 'ceo'
  reviewerName: string;
  result: 'Passed' | 'Failed';
  items: QcItem[];
  notes: string;
}

// A private message between two people. from / to are team member ids, or
// 'ceo' for the Head Manager. Only those two people can ever read it.
export interface TeamMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  at: string;              // ISO time
  readAt?: string;
}
