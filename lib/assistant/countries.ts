import { DOC_TEMPLATES } from '../constants';
import { stem } from './text';

// What an agent should know about each destination — written in general terms so it stays true
// when a fee or a processing time changes. Anything that changes often (fees, waiting times,
// who may apply online) is NOT quoted as a number; the reply always tells the agent to confirm it.

export interface Country {
  id: string;
  name: string;
  words: string[];                 // what people call it (already normalised: see tokens())
  desk: string;
  overview: string;
  visas: { name: string; note: string }[];
  process: string[];
  whenToApply: string;
  refusals: string[];
  tips: string[];
  funds: string;
  timing: string;
  student?: string[];
  work?: string[];
  family?: string[];
  sell: string;
  confirm: string;                 // where to check the current rules
}

export const COUNTRIES: Country[] = [
  {
    id: 'UK', name: 'United Kingdom', words: ['uk'], desk: 'UK desk',
    overview: 'The UK Standard Visitor visa covers tourism, visiting family and friends, and short business trips, normally for up to 6 months per visit. It is applied for online, followed by a biometrics appointment at the visa application centre.',
    visas: [
      { name: 'Standard Visitor', note: 'Tourism, family visits, short business. Normally up to 6 months.' },
      { name: 'Student', note: 'Needs a Confirmation of Acceptance for Studies (CAS) from a licensed university or college.' },
      { name: 'Skilled Worker', note: 'Needs a licensed sponsor employer and a Certificate of Sponsorship.' },
      { name: 'Family / spouse', note: 'Strict income, English and relationship requirements — check each case with your manager.' },
    ],
    process: ['Create the online application and fill in every question truthfully (including any earlier refusals).', 'Pay the visa fee online.', 'Book and attend the biometrics appointment at the visa application centre.', 'Upload or hand in the supporting documents.', 'Wait for the decision; the passport is returned (or the visa is sent digitally) afterwards.'],
    whenToApply: 'You can apply up to 3 months before the travel date. Do not buy non-refundable tickets before the decision.',
    refusals: ['The officer is not convinced the person will return home (weak ties: no job, family, property, business).', 'Funds that are too low, unexplained, or deposited suddenly just before applying.', 'Purpose of the visit or itinerary that does not make sense for the person’s profile.', 'Inconsistent details between the form, the documents and the interview/biometrics.', 'A previous refusal or overstay that was not declared — this is serious.'],
    tips: ['Ask for 6 months of bank statements showing regular income; explain any large deposit in the cover letter.', 'A clear day-by-day itinerary and accommodation make the plan believable.', 'Always declare previous refusals honestly; hiding one can lead to a long ban.', 'For family visits, the host’s invitation letter and proof of their status help, but they do not replace the applicant’s own ties.', 'Never use borrowed or edited documents.'],
    funds: 'There is no single fixed amount for a visitor visa: the officer expects enough money for the whole trip, in an account with a believable history.',
    timing: 'Standard visitor decisions are usually a matter of weeks, and faster paid services may exist — always check the current time before telling a client.',
    student: ['Get the CAS from the university first; the visa application depends on it.', 'Money for tuition and living costs must usually have been held in the account for a set period (check the current rule).', 'English-language proof and academic documents are needed; a credibility interview is possible.'],
    work: ['The job must come with a sponsor licence and a Certificate of Sponsorship; rules on salary and job type change often — check the official list.'],
    family: ['Family and spouse routes have strict requirements; open a file only after your manager has reviewed the case.'],
    sell: 'Our UK clients do best when the file tells one clear story: who they are, why they are travelling, how the trip is paid for, and why they will come back. We build that story and check every document against it.',
    confirm: 'GOV.UK visas pages and the visa application centre website for Pakistan',
  },
  {
    id: 'Schengen', name: 'Europe (Schengen)', words: ['schengen'], desk: 'Europe desk',
    overview: 'A Schengen short-stay visa allows travel across the Schengen countries for up to 90 days in any 180-day period. It is applied for at the embassy or consulate (usually through its visa centre) of the country where the person will spend the most time.',
    visas: [
      { name: 'Short-stay (Type C) tourist', note: 'Up to 90 days in any 180 days.' },
      { name: 'Business / conference', note: 'Needs an invitation from the host company or event.' },
      { name: 'Family / friends visit', note: 'Needs an invitation and the host’s documents.' },
      { name: 'National (long-stay) visas', note: 'Study and work visas are issued by each country with its own rules.' },
    ],
    process: ['Decide the country of main destination (longest stay; if equal, the country of first entry).', 'Book the appointment at that country’s visa centre — slots can be scarce, so start early.', 'Complete the form, buy valid travel insurance, and prepare bookings and bank documents.', 'Attend the appointment for fingerprints and photo, and submit the file.', 'Wait for the decision; the passport is returned with the visa or the refusal letter.'],
    whenToApply: 'Applications can usually be made up to 6 months before travel and no later than 15 calendar days before it. Appointments often run out, so apply early.',
    refusals: ['The purpose and conditions of the stay are not clear or not believable.', 'Insufficient funds, or statements that do not match the person’s income.', 'Documents that look unreliable, or an itinerary that does not match the bookings.', 'Travel insurance that does not meet the requirements.', 'No proof the person will return (ties), or a previous overstay or misuse of a visa.'],
    tips: ['Match the country to the real main destination — applying to an “easy” embassy is a classic cause of refusal.', 'Use reservations that can be cancelled free of charge; do not pay for non-refundable tickets before the decision.', 'The cover letter should state the purpose, dates, who pays, and why the person returns.', 'Insurance must cover the whole Schengen area and the whole stay, with the required medical cover.', 'Keep past Schengen visas and travel history — they help.'],
    funds: 'Each country sets a daily amount per person; the officer compares the statements with the trip length. Ask your Europe desk colleague for the current figure for that country.',
    timing: 'Decisions typically take around two weeks, but can be longer in busy seasons. Plan for more time than you think.',
    student: ['Study visas are national visas — rules, fees and funds differ by country; start from the university’s admission letter.'],
    work: ['Work visas need an employer and a work permit process that differs by country; refer to your manager.'],
    family: ['Spouses and children usually apply together with their own documents and the same insurance rules.'],
    sell: 'Europe visas are decided on the details. We choose the right embassy, plan the itinerary with refundable bookings, and prepare the cover letter and financial proof so the officer sees a clear, believable plan.',
    confirm: 'the official website of the embassy or visa centre of the country being applied to',
  },
  {
    id: 'USA', name: 'United States', words: ['usa'], desk: 'Australia, US & Canada desk',
    overview: 'Most visitors apply for the B-1/B-2 visitor visa. The process is: DS-160 online form, visa fee, appointment, and an interview with a consular officer — the decision is mostly made at the interview.',
    visas: [
      { name: 'B-1 / B-2 visitor', note: 'Business (B-1) or tourism and family visits (B-2).' },
      { name: 'F-1 student', note: 'Needs an I-20 from a school approved to enrol international students.' },
      { name: 'J-1 exchange', note: 'Needs a DS-2019 from an approved programme sponsor.' },
      { name: 'Work (for example H-1B)', note: 'The employer files a petition first — not something a visitor file can become.' },
    ],
    process: ['Complete the DS-160 online and keep the confirmation page.', 'Pay the visa application fee and book the interview appointment.', 'Attend the interview with the confirmation page, passport and supporting documents.', 'The officer usually tells the applicant the result at the end of the interview.', 'If approved, the passport is returned with the visa.'],
    whenToApply: 'Interview wait times can be long, so apply for an appointment as early as the plans allow. Do not buy tickets before the visa is issued.',
    refusals: ['Section 214(b): the officer is not satisfied the applicant intends to return home (weak ties) — the most common reason.', 'Answers at the interview that do not match the DS-160 or the documents.', 'Unclear purpose or unclear who pays for the trip.', 'Mistakes or false statements on the DS-160.'],
    tips: ['The interview is short: the applicant must answer simply, truthfully and consistently — practise with them.', 'Know the purpose, the dates, who pays, and the job, family and property in Pakistan.', 'A thick file does not help; what matters is a clear, honest story and genuine ties.', 'Never coach someone to say something untrue.'],
    funds: 'There is no fixed amount. The applicant must be able to explain how the trip will be paid for and show it is realistic.',
    timing: 'Appointment waiting times vary a lot; check the embassy’s current wait before promising any date.',
    student: ['Get the I-20 first, pay the SEVIS fee, then book the F-1 interview; the officer will look at the study plan, the school choice and the funds.'],
    work: ['Work visas are petition-based: the employer starts the process.'],
    family: ['Family members are normally interviewed individually or as a group, depending on the embassy’s rules.'],
    sell: 'For the US, the visa is won at the interview. Our value is the honest assessment, a correct DS-160, and interview preparation so that the applicant can explain their plan clearly and with confidence.',
    confirm: 'the US Embassy in Pakistan visa pages and travel.state.gov',
  },
  {
    id: 'Canada', name: 'Canada', words: ['canada'], desk: 'Australia, US & Canada desk',
    overview: 'Visitors from Pakistan normally apply for a Temporary Resident Visa (TRV) online and give biometrics. The officer looks for a genuine purpose, funds, and strong reasons to return.',
    visas: [
      { name: 'Visitor (TRV)', note: 'Tourism, family visits, business meetings.' },
      { name: 'Super Visa', note: 'For parents and grandparents of a Canadian citizen or permanent resident — needs a medical insurance policy and a minimum income of the host.' },
      { name: 'Study permit', note: 'Needs a letter of acceptance from a designated learning institution, and in many cases a provincial attestation letter — rules change often.' },
      { name: 'Work permit', note: 'Usually needs an employer offer and, in many cases, a labour market assessment.' },
    ],
    process: ['Create the online IRCC application and upload the documents.', 'Pay the application and biometrics fees.', 'Give biometrics at the visa application centre when asked.', 'Wait for the decision (the IRCC website shows current processing times).', 'If approved, the passport is sent for the visa to be placed in it.'],
    whenToApply: 'Apply well ahead of travel; processing times change, so check the IRCC page before giving a date.',
    refusals: ['The officer is not satisfied the person will leave Canada at the end of the stay.', 'Insufficient or unexplained funds, or a weak financial history.', 'Purpose of travel not clear, or travel history that raises questions.', 'Missing documents, or an application that is not completely filled in.'],
    tips: ['Write a clear cover letter: purpose, dates, who pays, ties to Pakistan.', 'Include an NOC/leave letter, business proof, family ties and previous travel.', 'For invitations, ask the host for proof of status and relationship.', 'Some people may be eligible to travel with an eTA instead of a visa — always check the IRCC eligibility tool.'],
    funds: 'No fixed number for a visitor visa; the officer compares the funds with the length and cost of the trip. Super Visa and study permits have their own money rules.',
    timing: 'Processing times are published by IRCC and move up and down; confirm before promising anything.',
    student: ['Check that the school is a designated learning institution and whether a provincial attestation letter is needed.', 'Show tuition and living funds, and a believable study plan.'],
    work: ['A job offer, the correct permit type and the employer’s compliance all matter — escalate to your manager.'],
    family: ['Parents and grandparents: Super Visa; spouses and dependants: depends on the principal applicant’s status.'],
    sell: 'Canadian files are won on documents and clarity. We prepare the cover letter, proof of funds and ties so that nothing in the file raises doubt, and we make sure the form and biometrics are done correctly.',
    confirm: 'the IRCC website (canada.ca) and the visa application centre pages for Pakistan',
  },
  {
    id: 'Australia', name: 'Australia', words: ['australia'], desk: 'Australia, US & Canada desk',
    overview: 'Most tourists and business visitors apply for the Visitor visa (subclass 600) online through an ImmiAccount. A health check or biometrics may be requested after lodging.',
    visas: [
      { name: 'Visitor (subclass 600)', note: 'Tourist, business visitor, or sponsored family stream.' },
      { name: 'Student (subclass 500)', note: 'Needs a Confirmation of Enrolment (CoE), health cover (OSHC) and the genuine student requirement.' },
      { name: 'Skilled / employer-sponsored', note: 'Points-based or sponsored routes — specialist advice needed.' },
    ],
    process: ['Create an ImmiAccount and complete the application online.', 'Upload the documents and pay the fee.', 'Respond quickly if the department asks for a health check, biometrics or more documents.', 'Wait for the decision, which arrives by email.'],
    whenToApply: 'Apply well before travel; there is no need to buy tickets until the grant.',
    refusals: ['The officer is not satisfied the person is a genuine visitor (or a genuine student).', 'Not enough funds, or funds that are not believable.', 'Ties to Pakistan not shown: job leave, family, business.', 'Incorrect or incomplete forms and documents.'],
    tips: ['Provide an employer leave letter or business proof, bank statements, and a simple itinerary.', 'For students: a clear study plan and why this course, this school and this country.', 'Answer every request from the department within the given time.'],
    funds: 'No set amount for visitors; the funds should match the length and cost of the stay.',
    timing: 'The department publishes processing times for each visa; check before quoting.',
    student: ['The genuine student requirement asks why the person wants to study this course in Australia and what they will do afterwards.', 'Show funds, English-language proof, and your OSHC.'],
    work: ['Skilled and sponsored visas depend on occupation lists and sponsors — involve your manager early.'],
    family: ['Partner and child visas have their own relationship and sponsor evidence rules.'],
    sell: 'Australia is strict about genuineness. We help the applicant explain their plan in their own words, with the documents to support it, and we avoid the common mistakes in the online form.',
    confirm: 'the Department of Home Affairs website (homeaffairs.gov.au)',
  },
  {
    id: 'New Zealand', name: 'New Zealand', words: ['newzealand'], desk: 'Australia, US & Canada desk',
    overview: 'A New Zealand visitor visa is applied for online with Immigration New Zealand. The officer checks the purpose, the funds and whether the person intends to leave.',
    visas: [{ name: 'Visitor', note: 'Tourism, visiting family or friends, short business.' }, { name: 'Student', note: 'Needs an offer of place from an approved school and proof of funds.' }],
    process: ['Create the online application and upload the documents.', 'Pay the fee.', 'Respond to any request for more information.', 'Receive the decision by email.'],
    whenToApply: 'Apply with enough time before travel; check current processing times.',
    refusals: ['Funds that are too low for the length of stay.', 'Unclear purpose or weak ties.', 'Missing documents.'],
    tips: ['Funds are normally assessed per month of stay (your portal checklist uses NZD 1,000 a month); a sponsor letter can help if someone else pays.', 'Provide a return ticket or onward travel plan, and a leave letter.'],
    funds: 'A monthly amount per person is the usual yardstick; confirm the current figure before telling a client.',
    timing: 'Published by Immigration New Zealand and updated regularly.',
    student: ['An offer of place and proof of tuition and living funds are the foundation.'],
    sell: 'We prepare a clean, complete online file with proof of funds and a clear plan, which is what New Zealand officers look for.',
    confirm: 'the Immigration New Zealand website (immigration.govt.nz)',
  },
  {
    id: 'UAE', name: 'UAE', words: ['uae'], desk: 'All-rounder',
    overview: 'UAE tourist and business visas are normally arranged online through approved channels. They are usually quick, but conditions for Pakistani passport holders can change.',
    visas: [{ name: 'Tourist', note: 'Short visit; often arranged through approved agents or airlines.' }, { name: 'Business', note: 'Needs an invitation from a UAE company.' }],
    process: ['Check current eligibility and extra requirements for a Pakistani passport.', 'Collect passport, photo, bank statements, hotel booking and return ticket.', 'Submit through the approved channel and track the application.'],
    whenToApply: 'Usually close to travel, but confirm the visa validity and the entry window.',
    refusals: ['Incomplete or unclear documents.', 'Conditions that are not met for the applicant’s profile (for example funds or sponsor).'],
    tips: ['Always check the latest requirements first — they have changed several times.', 'Keep hotel and return ticket consistent with the dates.'],
    funds: 'Check the current requirement; it can depend on the visa channel.',
    timing: 'Often a few working days, but confirm.',
    sell: 'We handle the checking and submission so the application is right the first time — no repeated rejections.',
    confirm: 'the official UAE ICP / GDRFA websites',
  },
  {
    id: 'Türkiye', name: 'Türkiye', words: ['turkiye'], desk: 'Europe desk',
    overview: 'Türkiye offers an online e-Visa to some Pakistani applicants (for example those with certain valid visas or residence permits); others apply for a visa through the consulate.',
    visas: [{ name: 'e-Visa (if eligible)', note: 'Online, fast; conditions apply.' }, { name: 'Consulate visa', note: 'For those who do not qualify for the e-Visa.' }],
    process: ['Check whether the applicant qualifies for the e-Visa.', 'If yes: apply online with the required documents.', 'If not: book an appointment for a consulate application and submit the documents.'],
    whenToApply: 'Check the entry window and the validity of the visa before booking.',
    refusals: ['Not meeting the e-Visa conditions.', 'Weak documents for a consulate application.'],
    tips: ['Check the eligibility conditions for e-Visa before promising it.', 'Hotel, return ticket and bank statements should match the dates.'],
    funds: 'Check the current requirement.',
    timing: 'e-Visa is quick; consulate applications take longer.',
    sell: 'We check whether the client qualifies for the quicker route first, then prepare the right file.',
    confirm: 'the official Türkiye e-Visa site and the consulate pages',
  },
  {
    id: 'Malaysia', name: 'Malaysia', words: ['malaysia'], desk: 'All-rounder',
    overview: 'Malaysia has online visa systems for some nationalities; for Pakistani applicants the exact route and conditions should be confirmed each time.',
    visas: [{ name: 'Tourist', note: 'Short visit.' }, { name: 'Business', note: 'Needs an invitation from a Malaysian company.' }],
    process: ['Check which online route the applicant is eligible for.', 'Prepare passport, photo, bank statements, hotel booking and return ticket.', 'Submit and track the application.'],
    whenToApply: 'Check the validity window of the approval.',
    refusals: ['Incomplete documents.', 'Applicant does not meet the route’s conditions.'],
    tips: ['Confirm the current route and fee first.', 'Keep dates consistent in all documents.'],
    funds: 'Check the current requirement.',
    timing: 'Usually quick; confirm.',
    sell: 'We choose the right route and submit a complete file, so the client does not lose time.',
    confirm: 'the official Malaysian immigration and eVisa sites',
  },
  {
    id: 'Saudi Arabia', name: 'Saudi Arabia', words: ['saudi'], desk: 'All-rounder',
    overview: 'Saudi visit visas are applied for online or through approved channels; eligibility depends on the passport and changes from time to time.',
    visas: [{ name: 'Visit / tourist', note: 'Check eligibility for a Pakistani passport.' }],
    process: ['Check eligibility on the official portal.', 'Prepare passport, photo, accommodation and return ticket.', 'Apply through the approved channel.'],
    whenToApply: 'Check validity and entry window.',
    refusals: ['Not eligible for that route.', 'Incomplete documents.'],
    tips: ['Never promise a visa before eligibility is confirmed.'],
    funds: 'Check the current requirement.',
    timing: 'Confirm before quoting.',
    sell: 'We confirm eligibility first so the client does not pay for something that cannot work.',
    confirm: 'the official Saudi visa portal',
  },
  {
    id: 'Azerbaijan', name: 'Azerbaijan', words: ['azerbaijan'], desk: 'All-rounder',
    overview: 'Azerbaijan uses an online e-Visa system (ASAN Visa); conditions for Pakistani applicants can change.',
    visas: [{ name: 'e-Visa', note: 'Online application.' }],
    process: ['Check the current conditions for a Pakistani passport.', 'Apply online with passport, photo and travel details.', 'Print the approval and carry it.'],
    whenToApply: 'Check the validity window.',
    refusals: ['Conditions not met; incomplete application.'],
    tips: ['Confirm the conditions before taking payment.'],
    funds: 'Check the current requirement.',
    timing: 'Usually quick; confirm.',
    sell: 'We check the conditions first, then submit the application correctly.',
    confirm: 'the official ASAN e-Visa site',
  },
  {
    id: 'Morocco', name: 'Morocco', words: ['morocco'], desk: 'All-rounder',
    overview: 'Pakistani travellers need to confirm the current entry route for Morocco; it may be a visa from the embassy or an online option.',
    visas: [{ name: 'Tourist', note: 'Check the current route.' }],
    process: ['Confirm the current route.', 'Prepare passport, photo, bank statements, hotel booking and return ticket.', 'Submit and track.'],
    whenToApply: 'Check validity and entry window.',
    refusals: ['Incomplete documents.'],
    tips: ['Confirm the rules before quoting.'],
    funds: 'Check the current requirement.',
    timing: 'Confirm before quoting.',
    sell: 'We confirm the route, prepare a complete file, and follow up until the decision.',
    confirm: 'the Moroccan embassy and official sites',
  },
];

export function countryByWord(token: string): Country | undefined {
  return COUNTRIES.find(c => c.words.some(w => stem(w) === token));
}

export function docsFor(countryId: string, visa: 'Tourist' | 'Business' = 'Tourist'): string[] {
  return DOC_TEMPLATES[`${countryId}|${visa}`] || DOC_TEMPLATES[`${countryId}|Tourist`] || DOC_TEMPLATES.default;
}
