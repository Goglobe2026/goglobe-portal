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
}

export interface ReferralAgent {
  id: string;
  name: string;
  phone: string;
  defaultCommissionPercent: number;
  notes: string;
  createdAt: string;
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
  bankName?: string;
  accountNo?: string;
  payItems?: { categoryId: string; amount: number }[];
}

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
