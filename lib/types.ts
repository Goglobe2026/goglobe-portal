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
  messages: { date: string; text: string; direction: 'In' | 'Out' }[];
  nextFollowUp: string;
  lastContacted: string;
  escalated: boolean;
  escalationReason: string;
  escalationResolved: boolean;
  lostReason: string;
}

export interface DocItem {
  id: string;
  name: string;
  order: number;
  status: 'Pending' | 'Received' | 'Verified';
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
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  party: string;
  amount: number;
  note: string;
}

export interface Campaign {
  id: string;
  name: string;
  platform: string;
  spend: number;
  startDate: string;
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
};

export type CollectionName = keyof Collections;

export type Session = { type: 'ceo' } | { type: 'employee'; staffId: string };
