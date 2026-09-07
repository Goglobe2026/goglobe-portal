// Run once after first deploy: `npm run seed`
// Writes starter data directly to /data so the portal isn't empty on first login.
// Safe to run again — it only creates files that don't already exist.
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function write(name, value) {
  const fp = path.join(DATA_DIR, `${name}.json`);
  if (fs.existsSync(fp)) {
    console.log(`skip  ${name}.json (already exists)`);
    return;
  }
  fs.writeFileSync(fp, JSON.stringify(value, null, 2));
  console.log(`wrote ${name}.json`);
}

const genId = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);

const t1 = genId('tm'), t2 = genId('tm'), t3 = genId('tm'), t4 = genId('tm'),
      t5 = genId('tm'), t6 = genId('tm'), t7 = genId('tm'), t8 = genId('tm');

const team = [
  { id: t1, name: 'Ayesha Raza', role: 'Senior Consultant', department: 'Sales', employeeId: 'GG-001', pin: '1001', phone: '0300 1000001', email: 'ayesha.raza@goglobeconsultants.com', shiftStart: '10:00', shiftEnd: '18:00', salary: 120000, commissionPercent: 4, bonusPerClose: 5000, lastSalaryPaid: '', jobDescription: '', education: 'BBA, Bahria University Islamabad', experience: '6 years in visa consultancy', contractType: 'Permanent', contractStart: '2022-03-01', contractEnd: '' },
  { id: t2, name: 'Bilal Ahmed', role: 'Sales Agent', department: 'Sales', employeeId: 'GG-002', pin: '1002', phone: '0300 1000002', email: 'bilal.ahmed@goglobeconsultants.com', shiftStart: '10:00', shiftEnd: '18:00', salary: 70000, commissionPercent: 3, bonusPerClose: 3000, lastSalaryPaid: '', jobDescription: '', education: 'BA, Punjab University', experience: '2 years customer sales', contractType: 'Permanent', contractStart: '2024-01-15', contractEnd: '' },
  { id: t3, name: 'Sana Tariq', role: 'Sales Agent', department: 'Sales', employeeId: 'GG-003', pin: '1003', phone: '0300 1000003', email: 'sana.tariq@goglobeconsultants.com', shiftStart: '11:00', shiftEnd: '19:00', salary: 70000, commissionPercent: 3, bonusPerClose: 3000, lastSalaryPaid: '', jobDescription: '', education: 'BS Commerce, FJWU', experience: '1.5 years telesales', contractType: 'Probation', contractStart: '2026-02-01', contractEnd: '2026-08-01' },
  { id: t4, name: 'Imran Malik', role: 'Operations Manager', department: 'Management', employeeId: 'GG-004', pin: '1004', phone: '0300 1000004', email: 'imran.malik@goglobeconsultants.com', shiftStart: '09:30', shiftEnd: '17:30', salary: 150000, commissionPercent: 0, bonusPerClose: 0, lastSalaryPaid: '', jobDescription: '', education: 'MBA, NUST Islamabad', experience: '10 years operations', contractType: 'Permanent', contractStart: '2021-06-01', contractEnd: '' },
  { id: t5, name: 'Zara Baig', role: 'Documentation Officer', department: 'Documentation', employeeId: 'GG-005', pin: '1005', phone: '0300 1000005', email: 'zara.baig@goglobeconsultants.com', shiftStart: '10:00', shiftEnd: '18:00', salary: 65000, commissionPercent: 0, bonusPerClose: 0, lastSalaryPaid: '', jobDescription: '', education: 'BA English, IIUI', experience: '3 years document verification', contractType: 'Permanent', contractStart: '2023-05-01', contractEnd: '' },
  { id: t6, name: 'Ahmed Raza', role: 'Marketing Executive', department: 'Marketing', employeeId: 'GG-006', pin: '1006', phone: '0300 1000006', email: 'ahmed.raza@goglobeconsultants.com', shiftStart: '10:00', shiftEnd: '18:00', salary: 75000, commissionPercent: 0, bonusPerClose: 0, lastSalaryPaid: '', jobDescription: '', education: 'BS Mass Comm, COMSATS', experience: '3 years digital marketing', contractType: 'Contract', contractStart: '2025-09-01', contractEnd: '2026-09-01' },
  { id: t7, name: 'Nida Yousaf', role: 'Accounts Officer', department: 'Accounts', employeeId: 'GG-007', pin: '1007', phone: '0300 1000007', email: 'nida.yousaf@goglobeconsultants.com', shiftStart: '10:00', shiftEnd: '18:00', salary: 68000, commissionPercent: 0, bonusPerClose: 0, lastSalaryPaid: '', jobDescription: '', education: 'B.Com, Punjab University', experience: '4 years bookkeeping', contractType: 'Permanent', contractStart: '2022-11-01', contractEnd: '' },
  { id: t8, name: 'Farrukh Hayat', role: 'Front Desk / Admin', department: 'Admin', employeeId: 'GG-008', pin: '1008', phone: '0300 1000008', email: 'farrukh.hayat@goglobeconsultants.com', shiftStart: '09:00', shiftEnd: '17:00', salary: 45000, commissionPercent: 0, bonusPerClose: 0, lastSalaryPaid: '', jobDescription: '', education: 'Intermediate', experience: '2 years front desk', contractType: 'Permanent', contractStart: '2024-04-01', contractEnd: '' },
];

const DESTINATIONS = ['UK', 'USA', 'Canada', 'Australia', 'Schengen', 'Türkiye', 'New Zealand', 'UAE', 'Malaysia', 'Saudi Arabia', 'Azerbaijan', 'Morocco'];
const VISA_TYPES = { Canada: ['Tourist', 'Business'], UAE: ['Tourist', 'Business'], Australia: ['Tourist', 'Business'], Malaysia: ['Tourist', 'Business'] };
const RATE_DEFAULTS = {
  'UK|Tourist': [95000, 6000], 'Schengen|Tourist': [85000, 5000], 'Canada|Tourist': [70000, 4000], 'Canada|Business': [90000, 5000],
  'UAE|Tourist': [35000, 2000], 'UAE|Business': [45000, 3000], 'USA|Tourist': [100000, 6000], 'Türkiye|Tourist': [38000, 2000],
  'Australia|Tourist': [80000, 5000], 'Australia|Business': [95000, 5500], 'New Zealand|Tourist': [75000, 4500],
  'Malaysia|Tourist': [30000, 2000], 'Malaysia|Business': [40000, 2500], 'Saudi Arabia|Tourist': [25000, 1500],
  'Azerbaijan|Tourist': [28000, 1500], 'Morocco|Tourist': [40000, 2000],
};
const ratecard = [];
DESTINATIONS.forEach(dest => {
  (VISA_TYPES[dest] || ['Tourist']).forEach(vt => {
    const [visaFee, apptFee] = RATE_DEFAULTS[`${dest}|${vt}`] || [40000, 2000];
    ratecard.push({ id: genId('rc'), destination: dest, visaType: vt, consultFee: 3000, visaFee, apptFee });
  });
});

const leads = [
  { id: genId('ld'), name: 'Usman Farooq', phone: '0301 2345678', source: 'WhatsApp', campaign: '', destination: 'UK', visaType: 'Tourist', stage: 'New', assignedTo: t2, createdAt: today(), notes: '', messages: [], nextFollowUp: today(), lastContacted: '' },
  { id: genId('ld'), name: 'Mehwish Ali', phone: '0333 1122334', source: 'Website', campaign: '', destination: 'Schengen', visaType: 'Tourist', stage: 'Contacted', assignedTo: t1, createdAt: today(), notes: '', messages: [], nextFollowUp: '2026-01-01', lastContacted: '2025-12-20' },
  { id: genId('ld'), name: 'Hamid Sheikh', phone: '0345 7788990', source: 'Facebook', campaign: '', destination: 'Canada', visaType: 'Business', stage: 'Qualified', assignedTo: t3, createdAt: today(), notes: '', messages: [], nextFollowUp: today(), lastContacted: '' },
];

const agent1 = genId('ra');
const referralagents = [
  { id: agent1, name: 'Salman Butt (Freelance Agent)', phone: '0300 5551234', defaultCommissionPercent: 50, notes: 'Sends 2-3 direct clients a month, mostly UAE and Canada business visas.', createdAt: today() },
];

const cases = [
  { id: genId('cs'), name: 'Fatima Z.', phone: '0300 1112233', destination: 'Schengen', visaType: 'Tourist', consultant: t1, caseStage: 'Decision', status: 'Approved', fee: 85000, paid: 85000, apptFee: 5000, apptPaid: 5000, consultFee: 3000, consultPaid: 3000, discount: 0, discountReason: '', costToExecute: 0, referralAgentId: '', referralCommissionPercent: 0, referralCommissionPaid: 0, createdAt: '2026-06-02', documents: [], coverLetterChecked: true, managerApproved: true },
  { id: genId('cs'), name: 'M. Hamza', phone: '0321 4445566', destination: 'UAE', visaType: 'Business', consultant: t3, caseStage: 'Documents', status: 'Active', fee: 45000, paid: 25000, apptFee: 3000, apptPaid: 0, consultFee: 3000, consultPaid: 3000, discount: 0, discountReason: '', costToExecute: 0, referralAgentId: '', referralCommissionPercent: 0, referralCommissionPaid: 0, createdAt: '2026-07-01', documents: [], coverLetterChecked: false, managerApproved: false },
  { id: genId('cs'), name: 'Referral Example — Tariq Aziz', phone: '0333 9998877', destination: 'Canada', visaType: 'Business', consultant: t1, caseStage: 'Decision', status: 'Approved', fee: 180000, paid: 180000, apptFee: 15000, apptPaid: 15000, consultFee: 5000, consultPaid: 5000, discount: 0, discountReason: '', costToExecute: 50000, referralAgentId: agent1, referralCommissionPercent: 50, referralCommissionPaid: 0, createdAt: '2026-07-20', documents: [], coverLetterChecked: true, managerApproved: true },
];

const appointments = [
  { id: genId('ap'), clientName: 'M. Hamza', phone: '0321 4445566', type: 'Embassy appointment', portal: 'UAE Consulate', date: today(), time: '11:00', status: 'Scheduled', consultant: t3 },
];

const transactions = [
  { id: genId('tx'), date: '2026-06-02', type: 'Income', category: 'Case payment', party: 'Fatima Z.', amount: 85000, note: 'Full fee — Schengen tourist visa' },
  { id: genId('tx'), date: '2026-07-05', type: 'Expense', category: 'Office rent', party: 'Landlord', amount: 60000, note: 'Monthly rent' },
];

const bankaccounts = [
  { id: genId('bk'), bankName: 'Meezan Bank', accountTitle: 'GoGlobe Consultant', accountNumber: 'XXXX-1234', balance: 250000 },
  { id: genId('bk'), bankName: 'Cash in hand', accountTitle: 'Office petty cash', accountNumber: '—', balance: 35000 },
];

write('team', team);
write('ratecard', ratecard);
write('leads', leads);
write('cases', cases);
write('appointments', appointments);
write('transactions', transactions);
write('bankaccounts', bankaccounts);
write('campaigns', []);
write('attendance', []);
write('adjustments', []);
write('journalvouchers', []);
write('requests', []);

const tour1 = genId('gt');
const grouptours = [
  { id: tour1, tourCode: 'EUR-2027-001', name: '2027 Europe New Year Group Tour', destination: 'Brussels, Amsterdam, Paris', startDate: '2026-12-26', endDate: '2027-01-05', capacity: 30, packagePrice: 495000, status: 'Limited Seats', description: 'A premium 11-day New Year group departure across Belgium, the Netherlands, and Paris — guided end to end by GoGlobe Consultant.', includedServices: ['Return international airfare', 'Visa processing assistance', '4-star hotel accommodation', 'Daily breakfast', 'Airport transfers', 'Guided city tours', 'Travel insurance', 'Dedicated GoGlobe tour coordinator'], createdAt: today() },
];
const tourmembers = [
  { id: genId('tmb'), tourId: tour1, referenceCode: 'GG-EUR-2027-001-001', name: 'Muhammad Ali', fatherName: 'Abdul Sattar', phone: '0300-1234567', whatsapp: '0300-1234567', email: 'muhammad.ali@example.com', cnic: '35202-1234567-1', passportNumber: 'AB1234567', passportExpiry: '2031-05-14', nationality: 'Pakistani', emergencyContact: 'Fatima Ali - 0300-7654321', address: 'House 12, Street 4, F-8, Islamabad', paid: 250000, totalDue: 495000, status: 'Documentation Complete', bookingDate: '2026-08-01' },
  { id: genId('tmb'), tourId: tour1, referenceCode: 'GG-EUR-2027-001-002', name: 'Ahmed Khan', fatherName: '', phone: '0301-2223344', whatsapp: '0301-2223344', email: '', cnic: '', passportNumber: '', passportExpiry: '', nationality: 'Pakistani', emergencyContact: '', address: '', paid: 495000, totalDue: 495000, status: 'Travel Confirmed', bookingDate: '2026-08-02' },
  { id: genId('tmb'), tourId: tour1, referenceCode: 'GG-EUR-2027-001-003', name: 'Sara Khan', fatherName: '', phone: '0302-3334455', whatsapp: '0302-3334455', email: '', cnic: '', passportNumber: '', passportExpiry: '', nationality: 'Pakistani', emergencyContact: '', address: '', paid: 495000, totalDue: 495000, status: 'Travel Confirmed', bookingDate: '2026-08-02' },
];

write('referralagents', referralagents);
write('grouptours', grouptours);
write('tourmembers', tourmembers);
write('testimonials', [
  { id: genId('ts'), caseId: cases[0].id, clientName: 'Fatima Z.', destination: 'Schengen', visaType: 'Tourist', quote: 'GoGlobe made the whole process so simple. My visa was approved without a single hiccup.', rating: 5, consentGiven: true, featured: true, createdAt: today() },
]);
write('activity', [{ t: 'Portal seeded with starter data', at: new Date().toISOString() }]);
write('ceopin', '9999');
write('revenuegoal', '10000000');

console.log('\nDone. Default CEO PIN is 9999 — change it from Reports & Finance after your first login.');
