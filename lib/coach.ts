import type { Lead, FollowUpTemplate } from './types';
import { DOC_TEMPLATES } from './constants';

// ---------------------------------------------------------------------------
// The Sales Coach: the company's way of working written down so that every agent
// follows the same steps — how often to follow up, how a lead is converted, what to
// say when a client hesitates, what to post. Nothing here is saved; it is all worked
// out from the agent's own leads and the date.
//
// The same material is the built-in "guide" the assistant answers from when no AI
// key is set up, and the background it gives an AI assistant when one is.
// ---------------------------------------------------------------------------

// ---------- how to follow up ----------
export interface CadenceStep { n: number; when: string; title: string; goal: string; do: string[]; say: string }
export const CADENCE: CadenceStep[] = [
  {
    n: 1, when: 'Within 15 minutes', title: 'First contact', goal: 'Be the first agent to reply, and book a consultation call.',
    do: ['Call first; if no answer, send the WhatsApp message straight after.', 'Ask three things: purpose of travel, travel history, planned dates.', 'Save the answers in the lead’s notes and set the next follow-up date before you leave the lead.'],
    say: 'Assalam o Alaikum {name}! This is {agent} from GoGlobe Consultant. Thank you for your {destination} visa enquiry. May I ask three quick questions so I can guide you properly? 1) What is the purpose of your trip? 2) Have you travelled abroad before? 3) When do you plan to travel?',
  },
  {
    n: 2, when: 'Next day', title: 'Follow-up 1 — one simple question', goal: 'Get a reply, however short.',
    do: ['No reply yet: one short message with one easy question.', 'Replied: send the process in 3 lines and the fees honestly (consultation, service fee, embassy fee separate).', 'Offer two consultation times to choose from.'],
    say: 'Hello {name}, {agent} here from GoGlobe Consultant. I wanted to make sure you received my message about your {destination} visa. Would today or tomorrow be better for a 10-minute call?',
  },
  {
    n: 3, when: 'Day 3', title: 'Follow-up 2 — give value', goal: 'Show that you know the country’s requirements.',
    do: ['Send the document checklist for their country.', 'Mention one common mistake you help clients avoid.', 'Ask which document they find hardest — that is where you can help.'],
    say: 'Hello {name}, here is the list of documents usually needed for a {destination} visit visa. Many applicants get stuck on bank statements and the cover letter — which of these would you like help with?',
  },
  {
    n: 4, when: 'Day 7', title: 'Follow-up 3 — social proof and slots', goal: 'Create a reason to decide this week.',
    do: ['Share a real, permitted client story (no names unless the client agreed).', 'Tell them how many consultation slots are open this week.', 'Ask for a clear yes or no to a consultation.'],
    say: 'Hello {name}, we have a few consultation slots left this week for {destination} files. Shall I reserve one for you? Applying with a complete file saves a lot of time.',
  },
  {
    n: 5, when: 'Day 14', title: 'Follow-up 4 — check their plan', goal: 'Find out if the trip is still on.',
    do: ['Ask if the travel plan changed.', 'If they are waiting for something (funds, leave, passport), note it and set the date they gave you.', 'Never argue — stay helpful.'],
    say: 'Hello {name}, I hope you are well. Are you still planning your {destination} trip? If something changed, tell me and I will advise what is best for your situation.',
  },
  {
    n: 6, when: 'Day 30', title: 'Follow-up 5 — the last friendly note', goal: 'Close the loop politely.',
    do: ['Send a last message that leaves the door open.', 'If there is still no reply, mark the lead Lost with the reason “no response” and keep them on your broadcast list.', 'Review: was the first reply fast enough?'],
    say: 'Hello {name}, I will close your {destination} enquiry for now so I do not disturb you. Whenever you are ready to travel, message me here and I will be happy to help.',
  },
];

export const FOLLOW_UP_RULES = [
  'One call and one message a day at most — more than that pushes people away.',
  'No messages after 9 pm or before 9 am.',
  'Every time you touch a lead, set the next follow-up date before you close it.',
  'Write what the client said in the notes, so the next person (or you, next week) can continue the conversation.',
  'If the client says stop, stop — mark the lead Lost with that reason.',
];

// ---------- how a lead becomes a client ----------
export interface ConvertStep { n: number; title: string; why: string; check: string[] }
export const CONVERSION: ConvertStep[] = [
  { n: 1, title: 'Reply fast', why: 'The first agent to answer usually wins the client.', check: ['Reply within 15 minutes in working hours.', 'Call, then WhatsApp.'] },
  { n: 2, title: 'Qualify', why: 'Know if you can help before you spend time.', check: ['Purpose of travel and dates', 'Travel history and any refusals', 'Passport validity', 'Job or business, and bank statements', 'Who is travelling (family file?)'] },
  { n: 3, title: 'Explain simply and be open about fees', why: 'Trust is what people pay for.', check: ['The process in 3 lines', 'Consultation fee, service fee and embassy fee — what is ours and what we pass on', 'Never promise approval; the embassy decides'] },
  { n: 4, title: 'Book the consultation', why: 'A booked slot is a real commitment.', check: ['Offer two times', 'Send the address or online link', 'Send the document list the same day'] },
  { n: 5, title: 'Handle hesitation', why: 'Hesitation usually means a question you have not answered yet.', check: ['Ask what is holding them back', 'Answer that one thing', 'Use “Ask the coach” if you are unsure'] },
  { n: 6, title: 'Ask for the advance', why: 'Nothing starts until the client commits.', check: ['Say the amount and what it covers', 'Offer the payment plan (part now, part at the appointment)', 'Tell your manager the moment it is paid so the case file is opened'] },
  { n: 7, title: 'Look after them after the sale', why: 'Happy clients bring the next clients.', check: ['Send the checklist and a clear timeline', 'Update them at every stage', 'After the decision, ask for a review and for people they know who are travelling'] },
];

// ---------- what to say when a client hesitates ----------
export interface Answer { id: string; title: string; keys: string[]; body: string; steps?: string[]; say?: string }
export const GUIDE: Answer[] = [
  {
    id: 'price', title: 'The client says the fee is too high', keys: ['fee', 'fees', 'price', 'expensive', 'costly', 'cost', 'high', 'discount', 'cheaper', 'mehnga', 'mehngi'],
    body: 'Do not drop the price straight away. Show what the fee covers, then offer a way to start.',
    steps: ['Ask: “Is it the total amount, or paying it all at once?”', 'List what they get: assessment, document checking, cover letter, form filling, appointment booking, follow-up until the decision.', 'Separate the embassy fee (passed on, not ours) from our service fee.', 'Offer the payment plan: part now, the rest at the appointment.', 'Any discount must be agreed with your manager first.'],
    say: 'I understand it is an important decision. Our fee covers your whole file — assessment, documents, cover letter, forms and the appointment. If it helps, we can split it: part now and the rest at the appointment. Shall I explain how that works?',
  },
  {
    id: 'think', title: '“I will think about it”', keys: ['think', 'later', 'wait', 'decide', 'soch', 'sochta', 'sochungi', 'baad'],
    body: 'This usually means one question is still unanswered. Find it, answer it, and agree on a date.',
    steps: ['Thank them, then ask: “What is the main thing you want to be sure about?”', 'Answer that one thing.', 'Agree a date and time to talk again — and set it as the follow-up date.', 'Send a short summary in writing so they can show it at home.'],
    say: 'Of course — it is your decision. So I can help you properly: what is the one thing you would like to be sure about before going ahead? I will also send you a short summary. Can I call you on {day}?',
  },
  {
    id: 'cheaper', title: 'Another agent is cheaper', keys: ['another', 'other agent', 'agency', 'competitor', 'cheaper', 'compare', 'dusra', 'doosra'],
    body: 'Compare what is included, not only the price. Never speak badly about another agent.',
    steps: ['Ask what the other agent includes and who will actually prepare the file.', 'Explain what you do that is different: file checking, cover letter, mistakes avoided, follow-up.', 'Point out that a refused file costs the embassy fee and months of time.', 'Invite them to the consultation — no pressure.'],
    say: 'That is fair — please compare what each offer includes. With us, your file is checked document by document and you have one person following it until the decision. Come for the consultation and judge for yourself.',
  },
  {
    id: 'guarantee', title: 'The client wants a guarantee', keys: ['guarantee', 'sure', '100%', 'certain', 'promise', 'approval', 'approved', 'pakka', 'yaqeen'],
    body: 'Never promise approval. Only the embassy decides. Honesty is what makes people trust you.',
    steps: ['Say clearly that no agent can guarantee a visa.', 'Explain what you CAN promise: an honest assessment, a complete and correct file, and support until the decision.', 'If their profile is weak, tell them what to improve first.'],
    say: 'I will be honest with you — nobody can guarantee a visa, only the embassy decides. What I can promise is an honest assessment and a complete, correct file. Let us look at your profile and I will tell you your real chances.',
  },
  {
    id: 'refusal', title: 'The client was refused before', keys: ['refused', 'refusal', 'rejected', 'rejection', 'reject', 'denied', 'inkar'],
    body: 'A refusal is not the end, but the reason must be fixed before applying again.',
    steps: ['Ask for the refusal letter and the date.', 'Read the reasons with your manager before promising anything.', 'Explain what must change this time (funds, ties, purpose of travel, documents).', 'Be honest if they should wait.'],
    say: 'Thank you for telling me. Please send me the refusal letter — we need to see the exact reason, fix it, and only then apply again. I will have it checked and give you a straight answer.',
  },
  {
    id: 'funds', title: 'Bank statement or funds are a problem', keys: ['bank', 'statement', 'funds', 'money', 'balance', 'savings', 'paisa', 'paise'],
    body: 'Explain what the embassy looks for. Never suggest showing money that is not theirs, or fake or edited documents.',
    steps: ['Ask about regular income and how long the savings have been in the account.', 'Explain: a steady history matters more than a last-minute deposit.', 'If funds are weak, advise to wait or to apply with a sponsor if that is allowed.', 'If a client asks for fake or temporary documents, say no and tell your manager.'],
    say: 'The embassy looks for steady income and savings built over time, not a sudden deposit. Let me see your last six months of statements and I will tell you honestly if you are ready or what to prepare first.',
  },
  {
    id: 'timing', title: 'How long will it take?', keys: ['how long', 'time', 'days', 'weeks', 'processing', 'when', 'kitna', 'kab'],
    body: 'Processing times change by embassy and season. Give a range from your manager, not a promise.',
    steps: ['Check the current time with your manager or the embassy’s page.', 'Explain the stages: documents, appointment, decision.', 'Tell them what they can speed up: sending documents fast.'],
    say: 'It depends on the embassy and the season. The part we control is getting your file ready quickly — the sooner your documents are complete, the sooner we can book. I will confirm the current processing time with my manager and tell you today.',
  },
  {
    id: 'noreply', title: 'The client does not reply', keys: ['reply', 'replying', 'respond', 'response', 'silent', 'ignore', 'ignoring', 'unreachable', 'seen', 'jawab', 'jawaab'],
    body: 'Do not send ten messages. Follow the follow-up steps and change the type of message each time.',
    steps: ['Try a call at a different time of day.', 'Next message: ask one easy yes/no question, or give something useful (checklist).', 'After three tries, send the “last friendly note”.', 'If still nothing after 30 days, mark the lead Lost with the reason “no response”.'],
    say: 'Hello {name}, just one quick question — are you still planning your {destination} trip? A simple yes or no is fine.',
  },
  {
    id: 'payment', title: 'The client agreed — how do I ask for the advance?', keys: ['advance', 'payment', 'pay', 'paid', 'close', 'closing', 'convert', 'sign', 'confirm', 'bayana'],
    body: 'Be clear and calm: say what the amount covers and what happens next.',
    steps: ['Confirm what they are getting and the total.', 'Say the advance amount and that work starts once it is received.', 'Offer the payment plan if they ask.', 'The moment it is paid, tell your manager so the case file is opened and the payment recorded.'],
    say: 'Great — I am glad we can work together. To start your file, the advance is PKR {amount}. It covers {what}. Once I have it, we begin right away and I will send you the document checklist today.',
  },
  {
    id: 'family', title: 'A family wants to apply together', keys: ['family', 'wife', 'husband', 'kids', 'children', 'parents', 'spouse', 'group', 'khandan'],
    body: 'Open one family file: one head of family, every member listed, one invoice.',
    steps: ['Get every member’s name, relation and passport details.', 'Explain the family fees (service fee per person; consultation fee once).', 'Tell your manager — the case is created as a “Family / group file”.', 'If they also want a group tour, it can be added to the tour from the case form.'],
  },
  {
    id: 'angry', title: 'The client is upset or complains', keys: ['angry', 'upset', 'complaint', 'complain', 'unhappy', 'rude', 'refund', 'ghussa', 'shikayat'],
    body: 'Stay calm, listen first, never argue, and bring your manager in early.',
    steps: ['Let them finish. Repeat their concern back to them.', 'Apologise for the experience (not for things that were not our fault).', 'Do not promise a refund or a result — tell them your manager will call.', 'Mark the lead as escalated in the portal with the reason.'],
    say: 'I am sorry you are going through this. I understand your concern and I want to put it right. I am asking my manager to call you today.',
  },
  {
    id: 'portal', title: 'How do I use the portal for my leads?', keys: ['portal', 'where', 'followup', 'follow-up', 'date', 'stage', 'notes', 'log', 'update', 'my leads', 'kahan'],
    body: 'Everything you do with a lead should be visible in the portal.',
    steps: ['“My leads” lists your leads — set the stage (New → Contacted → Qualified → Converted/Lost).', 'Pick the next follow-up date every time you speak to someone.', 'Use the WhatsApp button — it opens the chat with a ready message.', 'A lead that has paid: tell your manager so the case is opened.'],
  },
  {
    id: 'documents', title: 'The client asks which documents are needed', keys: ['document', 'documents', 'checklist', 'papers', 'list', 'required', 'requirements', 'kaghaz'],
    body: 'Send the country’s checklist and offer to check each item. The checklists below come from the portal.',
  },
  {
    id: 'referral', title: 'Asking for a referral or a review', keys: ['referral', 'refer', 'review', 'testimonial', 'recommend', 'sifarish'],
    body: 'The best time to ask is right after good news.',
    steps: ['Ask when the client is happiest — after approval or when they receive the passport.', 'Ask for a short review and for people they know who are planning to travel.', 'Ask them to quote their query number (like GG12) so we can link the new client to them.'],
    say: 'Alhamdulillah, I am so glad. If you are happy with our service, would you share a short review? And if anyone you know is planning to travel, please send them to us — they can quote your query number.',
  },
];

// Answers the assistant can give when no AI key is set up: the best matches by keyword.
// The guide's ready-made messages have blanks the agent must fill in; show them as [hints], never as {braces}.
const HINTS: Record<string, string> = { name: '[client name]', destination: '[country]', agent: '[your name]', amount: '[amount]', what: '[what it covers]', day: '[day]' };
export const bracket = (text: string) => text.replace(/\{(\w+)\}/g, (m, k: string) => HINTS[k] || `[${k}]`);

export interface GuideReply { title: string; body: string; steps?: string[]; say?: string }
export function askGuide(question: string, destination?: string): GuideReply[] {
  const q = ` ${question.toLowerCase().replace(/[^a-z0-9%À-ɏ؀-ۿ\s'-]/g, ' ').replace(/\s+/g, ' ')} `;
  if (!q.trim()) return [];
  const scored = GUIDE.map(a => {
    let score = 0;
    for (const k of a.keys) { if (q.includes(` ${k} `) || (k.length > 4 && q.includes(k))) score += k.includes(' ') ? 3 : 2; }
    if (q.trim() === a.title.toLowerCase().replace(/[^a-z0-9%À-ɏ؀-ۿ\s'-]/g, ' ').replace(/\s+/g, ' ').trim()) score += 3;   // the exact title was asked
    return { a, score };
  }).filter(x => x.score > 0).sort((x, y) => y.score - x.score);
  const out: GuideReply[] = scored.slice(0, 2).map(x => ({ title: x.a.title, body: x.a.body, steps: x.a.steps, say: x.a.say ? bracket(x.a.say) : undefined }));
  // documents: add the real checklist for the country asked about
  if (scored.some(x => x.a.id === 'documents') || /document|checklist|papers/.test(q)) {
    const list = checklistFor(destination || guessDestination(q) || 'UK');
    const hit = out.find(o => o.title.startsWith('The client asks which documents'));
    if (hit) hit.steps = list; else out.unshift({ title: `Documents for ${destination || guessDestination(q) || 'UK'}`, body: 'The usual checklist from the portal:', steps: list });
  }
  return out;
}
function guessDestination(q: string): string | null {
  const map: [RegExp, string][] = [[/\buk\b|britain|england|united kingdom/, 'UK'], [/schengen|europe|france|germany|italy|spain/, 'Schengen'], [/\busa\b|america|united states/, 'USA'], [/canada/, 'Canada'], [/australia/, 'Australia'], [/new zealand/, 'New Zealand'], [/uae|dubai/, 'UAE'], [/turkey|t[uü]rkiye/, 'Türkiye'], [/malaysia/, 'Malaysia']];
  return map.find(([re]) => re.test(q))?.[1] || null;
}
export function checklistFor(destination: string, visaType = 'Tourist'): string[] {
  return DOC_TEMPLATES[`${destination}|${visaType}`] || DOC_TEMPLATES.default;
}

export const QUICK_QUESTIONS = [
  'The client says the fee is too high',
  'The client says “I will think about it”',
  'The client does not reply',
  'How do I ask for the advance?',
  'The client was refused before',
  'Another agent is cheaper',
];

// ---------- marketing ----------
export const WEEK_PLAN: { day: string; focus: string; do: string[] }[] = [
  { day: 'Monday', focus: 'Plan and warm up', do: ['Pick this week’s focus country with your manager (UK first).', 'Go through all your leads: set a follow-up date on every open one.', 'Post today’s ready-made post on your WhatsApp Status.'] },
  { day: 'Tuesday', focus: 'Give value', do: ['Post the document checklist for your focus country.', 'Send the checklist to 10 leads who have not replied.'] },
  { day: 'Wednesday', focus: 'Build trust', do: ['Post a real client story (with permission) or the “no agent can guarantee a visa” post.', 'Ask two happy clients for a review.'] },
  { day: 'Thursday', focus: 'Create a reason to act', do: ['Tell leads how many consultation slots are open.', 'Call every lead who said “I will think about it” last week.'] },
  { day: 'Friday', focus: 'Reach new people', do: ['Share your post in 3 relevant groups you belong to.', 'Message 10 old clients: “Do you know anyone planning to travel?”'] },
  { day: 'Saturday', focus: 'Review', do: ['Count: new leads, calls, consultations booked, files closed.', 'Write down what worked; tell your manager what you need.'] },
];
export const DAILY_HABITS = [
  'Reply to every new lead within 15 minutes.',
  'Post one Status or story.',
  'Contact the leads whose follow-up is due today.',
  'Ask one happy client for a review or a referral.',
  'End the day with a follow-up date on every open lead.',
];

export const TIPS: { title: string; body: string }[] = [
  { title: 'Speed wins', body: 'The first agent who answers usually gets the client. Keep your phone near you when leads arrive.' },
  { title: 'Ask, then talk', body: 'Two good questions at the start tell you more than a long sales pitch.' },
  { title: 'One follow-up date, always', body: 'A lead without a next follow-up date is a lead you will forget.' },
  { title: 'Be honest about chances', body: 'Clients trust the agent who says “your profile needs work first”. They come back and they refer others.' },
  { title: 'Checklists build trust', body: 'Sending the exact document list shows you know the country — and gives the client a reason to reply.' },
  { title: 'Short messages get answers', body: 'Keep WhatsApp messages to a few lines and finish with one easy question.' },
  { title: 'Status is free advertising', body: 'A daily WhatsApp Status keeps you in front of everyone who has your number.' },
  { title: 'Use their name', body: 'Starting with the person’s name makes the message feel personal, not a broadcast.' },
  { title: 'Voice notes warm people up', body: 'A short voice note, in the client’s own language, builds a relationship faster than text.' },
  { title: 'Separate our fee from the embassy fee', body: 'Explaining which money is ours and which is passed on removes the biggest worry about hidden costs.' },
  { title: 'Never promise approval', body: 'The embassy decides. Promising what you cannot control costs you the client’s trust later.' },
  { title: 'Follow up after “I will think”', body: 'Most clients who say this are waiting for one answer. Ask what it is.' },
  { title: 'Families are bigger files', body: 'When one person asks, ask who else is travelling. A family file is more work for them and more value for you.' },
  { title: 'Ask for a referral at the happy moment', body: 'Right after the approval, ask for a review and for one name.' },
  { title: 'Quote the query number', body: 'Ask referred clients to quote the referrer’s query number (like GG12) so we can link them.' },
  { title: 'Keep your list warm', body: 'Old leads are not dead leads. A helpful message every few weeks brings some of them back.' },
  { title: 'Do not argue', body: 'If a client disagrees, ask a question instead of defending. You win more by understanding.' },
  { title: 'Calendar, not memory', body: 'Put every promised call in the portal’s follow-up date. Your memory will fail at 30 leads.' },
  { title: 'Practise your first 30 seconds', body: 'Your greeting and first question decide whether the person stays on the line.' },
  { title: 'Celebrate small wins', body: 'A booked consultation is already a win. Tell your team — it motivates everyone.' },
];
export function tipOfDay(dateStr: string) { return TIPS[dayNumber(dateStr) % TIPS.length]; }
export const BENEFITS = [
  'More replies: quick, personal messages get answered.',
  'More consultations: a clear follow-up routine means fewer forgotten leads.',
  'More closed files: answering the real question behind hesitation turns “maybe” into “yes”.',
  'More referrals: happy clients bring friends and family.',
  'A better month: your commission and bonus grow with the files you close.',
];

function dayNumber(dateStr: string): number {
  const t = Date.parse((dateStr || '1970-01-01') + 'T00:00:00Z');
  return Math.floor((Number.isFinite(t) ? t : 0) / 86400000);
}

// ---------- ready-made posts ----------
export type PostKind = 'consultation' | 'checklist' | 'myth' | 'update' | 'referral' | 'story';
export type PostLang = 'English' | 'Roman Urdu';
export const POST_KINDS: { id: PostKind; label: string; note: string }[] = [
  { id: 'consultation', label: 'Invite to a consultation', note: 'Gets people to message you' },
  { id: 'checklist', label: 'Document checklist', note: 'Gives value; the list comes from the portal' },
  { id: 'myth', label: '“No one can guarantee a visa”', note: 'Builds trust' },
  { id: 'update', label: 'Visa tip', note: 'Safe, general advice' },
  { id: 'referral', label: 'Ask for referrals', note: 'For happy clients' },
  { id: 'story', label: 'Client story (fill in)', note: 'Only with the client’s permission' },
];
export const POST_COUNTRIES = ['UK', 'Schengen', 'USA', 'Canada', 'Australia', 'New Zealand', 'Türkiye', 'UAE', 'Malaysia'];
const DEST_NAME: Record<string, string> = { UK: 'UK', Schengen: 'Europe (Schengen)', USA: 'USA', Canada: 'Canada', Australia: 'Australia', 'New Zealand': 'New Zealand', 'Türkiye': 'Türkiye', UAE: 'UAE', Malaysia: 'Malaysia' };
const tag = (d: string) => d.replace(/[^A-Za-z]/g, '');

export interface PostOpts { destination: string; kind: PostKind; lang: PostLang; agentName?: string; phone?: string }
export function buildPost(o: PostOpts): string {
  const d = DEST_NAME[o.destination] || o.destination;
  const ur = o.lang === 'Roman Urdu';
  const contact = [o.agentName ? `📞 ${o.agentName}` : '', o.phone || ''].filter(Boolean).join(' — ');
  const brand = 'GoGlobe Consultant';
  let body: string;
  switch (o.kind) {
    case 'consultation':
      body = ur
        ? `✈️ ${d} ka visa lagwana chahte hain?\n\nApply karne se *pehle* apni file kisi visa consultant se check karwayen — chhoti si ghalti mein mahine zaya ho sakte hain.\n\n✅ Aapki profile ka sahi jaiza\n✅ Documents ki saaf list\n✅ Submission tak step-by-step rehnumai\n\n📩 Aaj hi message karein aur consultation book karein.\nVisa ka faisla embassy karti hai — hum aapki file mukammal aur mazboot banate hain.`
        : `✈️ Planning a ${d} trip?\n\nGet your file checked by a visa consultant *before* you apply — one small mistake can cost you months.\n\n✅ An honest assessment of your profile\n✅ A clear list of documents\n✅ Step-by-step guidance until submission\n\n📩 Message us today to book your consultation.\nThe embassy makes the final decision — we make sure your file is complete and strong.`;
      break;
    case 'checklist': {
      const list = checklistFor(o.destination).slice(0, 8).map(x => `• ${x}`).join('\n');
      body = ur
        ? `📋 ${d} visit visa ke liye aam tor par yeh documents chahiye hote hain:\n\n${list}\n\nAapke case ke hisab se aur documents bhi lag sakte hain. File check karwane ke liye hamein message karein.`
        : `📋 Documents usually needed for a ${d} visit visa:\n\n${list}\n\nYour case may need more. Message us and we will check your file.`;
      break;
    }
    case 'myth':
      body = ur
        ? `❌ Ghalat fehmi: "Agent ${d} visa ki guarantee de sakta hai."\n\n✅ Sach: Faisla sirf embassy karti hai. Acha consultant aapki file mukammal aur durust banata hai, aur agar profile par pehle kaam chahiye to saaf bata deta hai.\n\nJo "100% approval" ka wada kare, us se hoshiyar rahein.`
        : `❌ Myth: "An agent can guarantee a ${d} visa."\n\n✅ Truth: Only the embassy decides. A good consultant makes your file complete, honest and strong — and tells you straight if your profile needs work first.\n\nBe careful with anyone who promises "100% approval".`;
      break;
    case 'update':
      body = ur
        ? `📢 ${d} visa tip:\n\n• Jaldi apply karein — aakhri waqt par appointments kam milte hain.\n• Passport ki validity pehle check karein.\n• Bank statement mein regular amdan nazar aani chahiye.\n• Kisi ko fee dene se pehle current requirements zaroor pooch lein.\n\nSawal hon to hamein message karein.`
        : `📢 ${d} visa tip:\n\n• Apply early — appointments get scarce close to travel dates.\n• Check your passport validity first.\n• Your bank statements should show regular income.\n• Before paying anyone, ask for the current requirements.\n\nQuestions? Message us.`;
      break;
    case 'referral':
      body = ur
        ? `🤝 Aap ke jaanne walon mein koi safar plan kar raha hai?\n\nUnhein hamare paas bhejein aur unse kahein ke aapka query number (jaise GG12) bata dein. Hum unki file ka poora khayal rakhenge.\n\nShukriya — aap ka bharosa hamari kamyabi hai. 🙏`
        : `🤝 Do you know someone planning to travel?\n\nSend them our way and ask them to quote your query number (like GG12). We will take good care of their file.\n\nThank you — your trust is what we are built on. 🙏`;
      break;
    case 'story':
    default:
      body = ur
        ? `🌟 Client ki kahani\n\n[Pehla naam] [shehar] se ${d} visa ke liye hamare paas aaye. [Unki mushkil kya thi]. Humne [kya kiya]. Natija: [natija].\n\nAap bhi apni file ka jaiza karwayen — message karein.\n\n(Sirf asli case aur client ki ijazat se post karein.)`
        : `🌟 Client story\n\n[First name] from [city] came to us for a ${d} visa. [Their challenge]. We [what we did]. Result: [result].\n\nWant your file reviewed? Message us.\n\n(Post only real cases, with the client’s permission.)`;
  }
  const hashtags = `#${tag(o.destination)}Visa #VisaConsultant #GoGlobe`;
  return `${body}\n\n${contact ? contact + '\n' : ''}${brand}\n${hashtags}`;
}

// The same post for everyone on a given day — the country and the type rotate.
const DAILY_COUNTRIES = ['UK', 'UK', 'Schengen', 'USA', 'UK', 'Canada', 'Australia', 'Schengen'];
const DAILY_KINDS: PostKind[] = ['consultation', 'checklist', 'myth', 'update', 'referral', 'checklist'];
export function postOfTheDay(dateStr: string, lang: PostLang, agentName?: string, phone?: string): { destination: string; kind: PostKind; text: string } {
  const n = dayNumber(dateStr);
  const destination = DAILY_COUNTRIES[n % DAILY_COUNTRIES.length];
  const kind = DAILY_KINDS[n % DAILY_KINDS.length];
  return { destination, kind, text: buildPost({ destination, kind, lang, agentName, phone }) };
}

// ---------- messages to leads ----------
export type ScriptKind = 'first' | 'followup' | 'value' | 'close' | 'revive' | 'escalate';
export function fill(text: string, ctx: { name: string; destination: string; agent: string }) {
  return text.replace(/\{name\}/g, ctx.name || 'there').replace(/\{destination\}/g, ctx.destination || 'visa').replace(/\{agent\}/g, ctx.agent || 'your consultant');
}
const firstWord = (n: string) => (n || '').trim().split(/\s+/)[0] || '';
export function outboundCount(l: Pick<Lead, 'messages'>) { return (l.messages || []).filter(m => m.direction === 'Out').length; }

// The message to send for this lead: the company's own template for this follow-up number if one has been
// written, otherwise the built-in step for the same number.
export function scriptFor(l: Lead, kind: ScriptKind, agent: string, templates: FollowUpTemplate[] = []): string {
  const ctx = { name: firstWord(l.name), destination: l.destination, agent };
  const n = outboundCount(l) + 1;
  if (kind === 'first') return fill(CADENCE[0].say, ctx);
  if (kind === 'followup' || kind === 'value') {
    const own = templates.find(t => t.followUpNumber === n) || (templates.length && n > Math.max(...templates.map(t => t.followUpNumber)) ? templates.slice().sort((a, b) => b.followUpNumber - a.followUpNumber)[0] : undefined);
    if (own && own.message.trim()) return own.message.replace(/\{name\}/gi, ctx.name).replace(/\{destination\}/gi, ctx.destination);
    return fill(CADENCE[Math.min(Math.max(n, 2), CADENCE.length) - 1].say, ctx);
  }
  if (kind === 'close') return fill(`Hello {name}, {agent} here from GoGlobe Consultant. Based on our conversation, I think we can prepare a strong {destination} file for you. To get started, I will send you the fee details and the payment options — including paying part now and the rest at the appointment. Shall I send them now?`, ctx);
  if (kind === 'revive') return fill(CADENCE[4].say, ctx);
  return fill('Hello {name}, I have asked my manager to look at your {destination} file personally. We will get back to you today.', ctx);
}

// ---------- what to do next, lead by lead ----------
export type Urgency = 'now' | 'today' | 'soon';
export interface CoachAction { leadId: string; name: string; destination: string; urgency: Urgency; title: string; why: string; steps: string[]; kind: ScriptKind; weight: number }

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

export function nextAction(l: Lead, todayStr: string, nowMs: number): CoachAction | null {
  if (l.stage === 'Converted' || l.stage === 'Lost') return null;
  const out = outboundCount(l);
  const base = { leadId: l.id, name: l.name, destination: l.destination };
  const vip = l.isVip ? 5 : 0, hot = l.interestLevel === 'High' ? 3 : 0;
  const arrived = l.receivedAt ? Date.parse(l.receivedAt) : Date.parse((l.createdAt || todayStr) + 'T00:00:00Z');
  const hoursOld = Math.max(0, (nowMs - (Number.isFinite(arrived) ? arrived : nowMs)) / 3600000);
  const daysOld = Math.max(0, daysBetween(l.createdAt || todayStr, todayStr));

  if (l.escalated && !l.escalationResolved) {
    return { ...base, urgency: 'now', kind: 'escalate', weight: 100 + vip, title: 'Waiting for your manager', why: l.escalationReason ? `Escalated: ${l.escalationReason}` : 'This lead was escalated and is not resolved yet.', steps: ['Tell the client that your manager will call today.', 'Check with your manager.', 'Do not promise a result.'] };
  }
  if (l.stage === 'New' && out === 0) {
    if (hoursOld < 24) return { ...base, urgency: 'now', kind: 'first', weight: 90 - Math.min(hoursOld, 24) + vip + hot, title: hoursOld < 2 ? 'New lead — contact in the next few minutes' : 'New lead is waiting for your first message', why: hoursOld < 2 ? 'The first agent to reply usually wins the client.' : `Came in ${Math.round(hoursOld)} hours ago and nobody has contacted them.`, steps: CADENCE[0].do };
    return { ...base, urgency: 'now', kind: 'first', weight: 80 + Math.min(daysOld, 10) + vip + hot, title: `Never contacted — ${daysOld} day${daysOld === 1 ? '' : 's'} old`, why: 'The longer a lead waits, the less likely they are to reply. Call first, then message.', steps: CADENCE[0].do };
  }
  if (l.nextFollowUp && l.nextFollowUp <= todayStr) {
    const late = Math.max(0, daysBetween(l.nextFollowUp, todayStr));
    const step = CADENCE[Math.min(Math.max(out + 1, 2), CADENCE.length) - 1];   // a lead that has been contacted never gets the “first contact” steps again
    return { ...base, urgency: late >= 3 ? 'now' : 'today', kind: l.stage === 'Qualified' ? 'close' : out >= 2 ? 'value' : 'followup', weight: 60 + Math.min(late, 20) + vip + hot, title: late === 0 ? `Follow-up ${Math.max(1, out)} is due today` : `Follow-up overdue by ${late} day${late === 1 ? '' : 's'}`, why: l.stage === 'Qualified' ? 'This client was interested — keep the momentum and move to the advance.' : `${step.title}: ${step.goal}`, steps: l.stage === 'Qualified' ? CONVERSION[5].check : step.do };
  }
  if (l.stage === 'Qualified') {
    const last = l.lastContacted || l.createdAt;
    const quiet = Math.max(0, daysBetween(last, todayStr));
    if (quiet >= 2 || !l.nextFollowUp) return { ...base, urgency: 'today', kind: 'close', weight: 55 + Math.min(quiet, 10) + vip + hot, title: 'Interested client — ask for the advance', why: quiet ? `Last contact ${quiet} day${quiet === 1 ? '' : 's'} ago. Interested clients cool quickly.` : 'They are qualified — the next step is the advance.', steps: CONVERSION[5].check };
    return null;
  }
  if (l.stage === 'Contacted' && !l.nextFollowUp) {
    return { ...base, urgency: 'today', kind: 'followup', weight: 45 + vip + hot, title: 'No follow-up date set', why: 'A lead without a next date gets forgotten. Set one after every contact.', steps: ['Decide the next step with the client.', 'Pick the follow-up date in “My leads”.', 'Write what they said in the notes.'] };
  }
  const last = l.lastContacted || l.createdAt;
  const quiet = last ? Math.max(0, daysBetween(last, todayStr)) : 0;
  if (l.stage === 'Contacted' && quiet >= 10) return { ...base, urgency: 'soon', kind: 'revive', weight: 25 + Math.min(quiet, 30) + vip + hot, title: `Quiet for ${quiet} days`, why: 'A short, friendly check on their plans often brings them back.', steps: CADENCE[4].do };
  return null;
}

const URG: Record<Urgency, number> = { now: 0, today: 1, soon: 2 };
export function coachQueue(leads: Lead[], staffId: string, todayStr: string, nowMs: number, limit = 12): { items: CoachAction[]; total: number; now: number; today: number; soon: number } {
  const all = leads.filter(l => l.assignedTo === staffId).map(l => nextAction(l, todayStr, nowMs)).filter((x): x is CoachAction => !!x);
  all.sort((a, b) => URG[a.urgency] - URG[b.urgency] || b.weight - a.weight || a.name.localeCompare(b.name));
  return { items: all.slice(0, limit), total: all.length, now: all.filter(a => a.urgency === 'now').length, today: all.filter(a => a.urgency === 'today').length, soon: all.filter(a => a.urgency === 'soon').length };
}

// ---------- the AI assistant's brief (used by the server) ----------
export const COACH_SYSTEM = `You are the Sales Coach inside the GoGlobe Consultant portal, a visa and travel consultancy in Pakistan. You help sales agents handle leads and clients.

Rules:
- Be practical and brief: give 3 to 6 numbered steps and, when useful, one short message the agent can send on WhatsApp.
- Never promise or imply a guaranteed visa approval; only the embassy decides.
- Never suggest fake, edited or borrowed documents, hiding facts from an embassy, or anything illegal or deceptive. If asked, refuse and say to tell the manager.
- Be honest about chances; advise when a client should wait or improve the profile first.
- Fees and discounts are decided by the manager; do not invent prices, processing times or embassy rules. If you do not know a current rule, say so and suggest checking with the manager or the embassy website.
- Reply in the language of the question (English or Roman Urdu).
- You only help with sales, follow-up, marketing and client communication for this business.

The company's way of working:
${CADENCE.map(c => `Follow-up ${c.n} (${c.when}): ${c.title} — ${c.goal}`).join('\n')}
Conversion steps: ${CONVERSION.map(c => `${c.n}. ${c.title}`).join('; ')}.
Follow-up rules: ${FOLLOW_UP_RULES.join(' ')}`;
