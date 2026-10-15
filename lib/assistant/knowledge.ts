import { GUIDE } from '../coach';

// ---------------------------------------------------------------------------
// What the assistant knows besides your live data. Written by us, so it needs no
// AI service and no key. Four kinds:
//   sales   – how to talk to clients, follow up, handle doubts, close
//   portal  – where things are in this portal and which button to press
//   money   – what the Finance words mean
//   define  – short explanations of visa words (cover letter, NOC, biometrics…)
//
// `q` is a list of ways people ask the same thing, in English and Roman Urdu — the
// search reads it together with the title and the answer. Fees and waiting times
// are never written as numbers here, because they change.
// ---------------------------------------------------------------------------

export type EntryKind = 'sales' | 'portal' | 'money' | 'define';
export interface Entry {
  id: string; kind: EntryKind; title: string;
  q: string;                      // other ways to ask it
  answer: string;
  steps?: string[];
  say?: string; sayUr?: string;   // a message the agent can send ({name} {destination} {agent} get filled in)
  ur?: string;                    // the answer in a few words of Roman Urdu
  follow?: string[];              // good next questions
  go?: { tab: string; label: string }[];
  headOnly?: boolean;
}

// Roman Urdu for the guide entries that already exist in lib/coach.ts.
const GUIDE_UR: Record<string, { q: string; ur: string; sayUr?: string; follow?: string[] }> = {
  price: { q: 'fees zyada hain mehngi hai discount kam karo client kehta hai fee bohat hai', ur: 'Foran price kam na karein. Pehle batayein ke fee mein kya kya shamil hai (file check, documents, cover letter, form, appointment, decision tak follow-up). Embassy fee alag batayein. Phir "kuch abhi, baqi appointment par" wala plan offer karein. Discount sirf manager ki ijazat se.', sayUr: 'Main samajhta hoon ke yeh bara faisla hai. Hamari fee mein aap ki poori file shamil hai — jaiza, documents, cover letter, forms aur appointment. Chaahein to hum isay do hisson mein kar sakte hain: kuch abhi aur baqi appointment par. Kya main tafseel bata doon?', follow: ['Can I give a discount?', 'How do I ask for the advance?'] },
  think: { q: 'soch kar bataunga baad mein bataunga sochna hai wait', ur: 'Iska matlab aksar yeh hota hai ke ek sawal abhi baqi hai. Poochein "kis baat ka yaqeen chahiye?", sirf wohi jawab dein, aur agle call ki tareekh tay karke follow-up date lagayein.', sayUr: 'Bilkul, faisla aap ka hai. Taake main sahi madad kar sakoon: wo ek baat kaun si hai jis ka aap ko yaqeen chahiye? Main aap ko chhota sa summary bhi bhej deta hoon. Kya main {day} ko call kar sakta hoon?' },
  cheaper: { q: 'dusra agent sasta hai doosra agent competitor', ur: 'Sirf price nahi, yeh dekhein ke kya kya shamil hai. Kisi aur agent ki burai na karein. Consultation par bulayein — koi pressure nahi.', sayUr: 'Theek hai, aap dono ki offer compare karein ke kya kya shamil hai. Hamare saath har document check hota hai aur decision tak aap ki file ek hi banda follow karta hai. Consultation par aa kar khud faisla karein.' },
  guarantee: { q: 'guarantee pakka yaqeen 100% approval wada', ur: 'Kabhi guarantee ya approval ka wada na karein — faisla sirf embassy karti hai. Sach bolna hi bharosa banata hai. Aap sirf yeh wada kar sakte hain: honest jaiza, mukammal file, aur decision tak saath.', sayUr: 'Main aap se sach kahunga — koi bhi guarantee nahi de sakta, faisla sirf embassy karti hai. Main yeh wada karta hoon ke honest jaiza aur mukammal, durust file. Aaiye aap ki profile dekhte hain, phir main aap ko asal chances bata dunga.' },
  refusal: { q: 'pehle refuse ho chuka inkar refusal letter', ur: 'Refusal ka matlab end nahi, lekin wajah theek karne se pehle dobara apply na karein. Refusal letter aur tareekh maangein, manager ke saath wajah parhein, aur honest rahein agar intezar behtar ho.', sayUr: 'Batane ka shukriya. Meherbani kar ke refusal letter bhej dein — hamein asal wajah dekhni hai, usay theek karna hai, phir apply karna hai. Main file check karwa kar aap ko seedha jawab dunga.' },
  funds: { q: 'bank statement paise savings balance funds kam hain', ur: 'Embassy musalsal amdan aur waqt ke saath bani savings dekhti hai, achanak jama ki hui raqam nahi. Jaali ya kisi aur ke paise wale documents ka kabhi na kahein — manager ko batayein.', sayUr: 'Embassy musalsal amdan aur dheere dheere bani savings dekhti hai, achanak deposit nahi. Apne pichle 6 mahine ki statements bhej dein, main honestly bata dunga ke aap tayyar hain ya pehle kya karna hai.' },
  timing: { q: 'kitna time lagega kitne din kab tak processing', ur: 'Time embassy aur season ke hisab se badalta hai. Wada na karein — manager se ya embassy ki website se maujooda range maloom karke batayein. Jo hamare haath mein hai: file jaldi mukammal karna.', sayUr: 'Yeh embassy aur season par munhasir hai. Jo hamare haath mein hai wo aap ki file jaldi tayyar karna hai. Main maujooda processing time confirm karke aaj hi bata deta hoon.' },
  noreply: { q: 'reply nahi karta jawab nahi deta call nahi uthata seen kar diya', ur: 'Das messages na bhejein. Follow-up steps par chalein, har baar message ki qisam badlein: ek asaan yes/no sawal, phir checklist, phir "aakhri dostana note". 30 din baad bhi jawab na aaye to Lost mark karein (wajah: no response).', sayUr: 'Assalam o Alaikum {name}! Bas ek chhota sawal — kya aap abhi bhi {destination} ka safar plan kar rahe hain? Sirf haan ya na bata dein.' },
  payment: { q: 'advance maangna bayana payment kaise maangon convert close', ur: 'Saaf aur pur-sukoon andaz mein advance ki raqam batayein, yeh bhi ke is mein kya shamil hai aur aage kya hoga. Payment aate hi manager ko batayein taake case file khul jaye.', sayUr: 'Bohat khushi hui ke hum saath kaam karenge. File shuru karne ke liye advance PKR {amount} hai, jis mein {what} shamil hai. Mil jaye to hum usi waqt kaam shuru kar dete hain aur aaj hi checklist bhej dete hain.' },
  family: { q: 'family saath apply biwi bachay walidain group khandan', ur: 'Ek family file kholein: ek head of family, har member ka naam/rishta/passport, aur ek invoice. Manager ko batayein taake case "Family / group file" ban jaye. Group tour mein bhi case form se shamil kiya ja sakta hai.' },
  angry: { q: 'client naraz hai ghussa shikayat complaint refund', ur: 'Pehle poori baat sunein, bahes na karein, manager ko jaldi shamil karein. Refund ya result ka wada na karein — keh dein ke manager aaj call karenge. Portal mein lead ko escalate kar dein.', sayUr: 'Mujhe afsos hai ke aap ko yeh mushkil pesh aayi. Main aap ki baat samajhta hoon aur isay theek karna chahta hoon. Main apne manager se kehta hoon ke wo aaj aap ko call karein.' },
  portal: { q: 'portal kaise use karun follow up date stage notes', ur: '"My leads" mein stage badlein (New → Contacted → Qualified → Converted/Lost), har baat ke baad agli follow-up date lagayein, WhatsApp button se ready message kholein.' },
  documents: { q: 'kaghazat documents checklist list kya chahiye', ur: 'Mulk ke hisab se checklist bhejein aur har item check karne ki peshkash karein. Neeche portal ki checklist hai.' },
  referral: { q: 'referral review testimonial sifarish recommend', ur: 'Sab se acha waqt approval ke foran baad hai. Chhota review aur kisi aise shakhs ka naam maangein jo safar plan kar raha ho, aur kahein ke apna query number (jaise GG12) bata dein.', sayUr: 'Alhamdulillah, bohat khushi hui. Agar aap hamari service se khush hain to chhota sa review dein, aur agar aap ke jaanne walon mein koi safar plan kar raha ho to unhein hamare paas bhejein — wo aap ka query number bata sakte hain.' },
};

function fromGuide(): Entry[] {
  return GUIDE.map(g => {
    const u = GUIDE_UR[g.id];
    return {
      id: `g-${g.id}`, kind: 'sales' as const, title: g.title,
      q: `${g.keys.join(' ')} ${u?.q || ''}`, answer: g.body, steps: g.steps, say: g.say, sayUr: u?.sayUr, ur: u?.ur, follow: u?.follow,
    };
  });
}

const SALES: Entry[] = [
  {
    id: 'qualify', kind: 'sales', title: 'How to qualify a new lead',
    q: 'qualify qualification first call questions ask what to ask new lead serious genuine pehli call kya poochun lead kaisi hai',
    answer: 'Spend your first two minutes finding out whether you can really help. Good questions beat a long pitch.',
    steps: ['Purpose of travel and the dates they have in mind.', 'Travel history, and any earlier refusal (ask gently — it changes the plan).', 'Passport validity and who is travelling.', 'Job or business, and whether they have bank statements showing regular income.', 'Who pays for the trip.', 'Then decide: strong file, needs work first, or not a fit — and say so honestly.', 'Write the answers in the lead notes and set the next follow-up date.'],
    ur: 'Pehle do minute mein maloom karein: safar ka maqsad aur tareekh, pehle ka travel/refusal, passport validity, job ya business aur bank statement, kharcha kaun uthayega. Phir honestly batayein ke file mazboot hai ya pehle kaam chahiye. Jawab notes mein likhein aur follow-up date lagayein.',
    follow: ['What do I say in the first message?', 'The client was refused before'],
  },
  {
    id: 'firstmsg', kind: 'sales', title: 'First message to a new Facebook / Instagram lead',
    q: 'first message new lead facebook instagram ad form pehla message hello opening greeting introduce reach out contact new enquiry',
    answer: 'Be the first to reply (within 15 minutes if you can). Call first; if there is no answer, send this on WhatsApp straight after.',
    say: 'Assalam o Alaikum {name}! This is {agent} from GoGlobe Consultant. Thank you for your {destination} visa enquiry. May I ask three quick questions so I can guide you properly? 1) What is the purpose of your trip? 2) Have you travelled abroad before? 3) When do you plan to travel?',
    sayUr: 'Assalam o Alaikum {name}! Main {agent} GoGlobe Consultant se. {destination} visa ki enquiry ka shukriya. Sahi rehnumai ke liye teen chhote sawal: 1) Safar ka maqsad kya hai? 2) Pehle kabhi bahar gaye hain? 3) Kab jana chahte hain?',
    ur: 'Sab se pehle jawab dein (15 minute ke andar). Pehle call, phir WhatsApp. Neeche tayyar message hai.',
    follow: ['How often should I follow up?', 'How do I qualify a lead?'],
  },
  {
    id: 'freq', kind: 'sales', title: 'How often should I follow up?',
    q: 'how often how many times follow up frequency every day daily kitni baar kitne din baad follow up schedule cadence when to call again gap kaise follow up karun karna follow up kab karun follow up kitni dafa',
    answer: 'Follow the same six steps for every lead: within 15 minutes, next day, day 3, day 7, day 14, day 30. One call and one message a day at most.',
    steps: ['Day 0 (15 minutes): first contact — three questions.', 'Day 1: one easy question.', 'Day 3: send the document list for their country.', 'Day 7: real story and open consultation slots.', 'Day 14: ask if the plan changed.', 'Day 30: last friendly note, then mark Lost (no response) if still silent.', 'After every contact, set the next follow-up date before you leave the lead.'],
    ur: 'Har lead par wohi 6 qadam: 15 minute ke andar, agle din, din 3, din 7, din 14, din 30. Ek din mein zyada se zyada ek call aur ek message. Har contact ke baad agli follow-up date zaroor lagayein.',
    go: [{ tab: 'coach', label: 'Open the follow-up steps' }],
    follow: ['The client does not reply', 'What should I do today?'],
  },
  {
    id: 'channel', kind: 'sales', title: 'Call, voice note or text — which is better?',
    q: 'call or message voice note whatsapp text which better phone call vs message audio note kaun sa tareeqa call karun ya message',
    answer: 'Use all three, in this order: call first (fast, personal), a WhatsApp message straight after if there is no answer, and a short voice note when the client prefers talking in their own language.',
    steps: ['New lead: call, then message.', 'Follow-ups: a short message with one easy question works best.', 'Hesitant client: a one-minute voice note feels personal and builds trust.', 'Never message before 9 am or after 9 pm.'],
    ur: 'Pehle call, jawab na aaye to foran WhatsApp. Jo client apni zubaan mein baat pasand karta hai usay chhota voice note bhejein. Subah 9 se pehle aur raat 9 ke baad message na karein.',
  },
  {
    id: 'feeschat', kind: 'sales', title: 'Should I share the fee on chat before a call?',
    q: 'share fee on chat price before call send fees whatsapp client asks fee first message kitni fee hai pehle fee batana',
    answer: 'Be open about fees, but give them together with what is included. A bare number invites comparison; a number with the value attached starts a conversation.',
    steps: ['Say the fee in three parts: consultation, our service fee, and the embassy fee (which we only pass on).', 'Say what the service covers: assessment, documents, cover letter, forms, appointment, follow-up.', 'Offer the payment plan if it helps.', 'Then invite them to the consultation — that is where you convert.'],
    say: 'Hello {name}, our fee depends on your file, and it is in three parts: the consultation, our service fee (document checking, cover letter, forms, appointment and follow-up), and the embassy fee, which we only pass on. Could we speak for 10 minutes today so I can give you the exact figure for your case?',
    sayUr: 'Assalam o Alaikum {name}, hamari fee aap ki file ke hisab se hoti hai aur teen hisson mein hai: consultation, hamari service fee (documents check, cover letter, forms, appointment aur follow-up) aur embassy fee jo hum sirf aage dete hain. Kya aaj 10 minute baat ho sakti hai taake main aap ke case ki asal figure bata sakoon?',
    follow: ['The client says the fee is too high', 'How do I ask for the advance?'],
    go: [{ tab: 'pricing', label: 'Pricing by Country' }],
  },
  {
    id: 'nomoney', kind: 'sales', title: 'The client has no money right now',
    q: 'no money paise nahi abhi paise nahi afford later salary next month cannot pay installment budget funds kam hain abhi nahi',
    answer: 'Do not push. Find out whether it is a timing problem or a real one, and offer the payment plan.',
    steps: ['Ask: “Is it the whole amount, or paying it all at once?”', 'Offer to split it: part now, the rest at the appointment (your manager sets the plan in the case).', 'If they truly cannot start yet, agree a date and set it as the follow-up — a promise with a date is a lead you keep.', 'Never suggest borrowing to show funds on a statement.'],
    ur: 'Zor na dalein. Poochein ke masla poori raqam ka hai ya ek saath dene ka. Plan offer karein: kuch abhi, baqi appointment par. Agar abhi mumkin nahi to tareekh tay karke follow-up date lagayein. Statement mein dikhane ke liye udhaar lene ka mashwara kabhi na dein.',
  },
  {
    id: 'spouse', kind: 'sales', title: 'The client needs to ask their family first',
    q: 'ask family husband wife parents spouse permission discuss at home father mother decision maker ghar mein poochna biwi shohar walid',
    answer: 'The decision maker may not be the person you are talking to. Help them explain it at home.',
    steps: ['Ask who else is involved and offer to speak to them too.', 'Send a short written summary of the process and fees they can show at home.', 'Offer a joint call or an office visit for the family.', 'Agree a day to call back and set it as the follow-up.'],
    say: 'Of course, {name}, it is good to decide together. I will send you a short summary you can share at home. If you like, I can also speak to your family on a call and answer their questions. Can I call you on [day]?',
    ur: 'Faisla karne wala koi aur ho sakta hai. Chhota likhit summary bhejein, family ke saath joint call ya office visit offer karein, aur callback ka din tay karke follow-up date lagayein.',
  },
  {
    id: 'trust', kind: 'sales', title: 'Are you registered? Is this safe?',
    q: 'trust fraud scam registered licence license safe genuine company office address legal bharosa jhoota fake agent kya aap registered hain office kahan',
    answer: 'Doubt is healthy. Answer calmly, show proof, and invite them to the office — never be defensive.',
    steps: ['Give the office address and invite them to visit.', 'Share real, permitted client stories and reviews.', 'Explain exactly what you do and what you do NOT promise (no guarantees).', 'Explain how payments are recorded: every payment gets a receipt.', 'Tell them they are welcome to check with the embassy about any rule we mention.'],
    say: 'You are right to ask, {name}. We are at [office address] and you are welcome to visit anytime. Every payment is recorded and receipted, and we never promise approval — only the embassy decides. I can also share some real client reviews. Would you like to come in or have a call first?',
    ur: 'Shak thik hai — pur-sukoon jawab dein. Office ka pata dein aur visit ki dawat dein, asli reviews dikhayein, saaf batayein ke hum guarantee nahi dete, aur batayein ke har payment ki receipt hoti hai.',
    follow: ['The client wants a guarantee', 'How do I get success stories to show?'],
  },
  {
    id: 'proof', kind: 'sales', title: 'Using success stories and reviews',
    q: 'success story proof reviews testimonial show results previous clients social proof approved cases kamyab kahani misal',
    answer: 'Real stories build trust faster than any claim — but only with the client’s permission, and never with their documents or private details.',
    steps: ['Open Marketing → Success Stories to see the approved cases and testimonials.', 'Share the story, not the paperwork.', 'Use a first name only unless the client agreed to more.', 'Never present a story as a promise of the same result.'],
    go: [{ tab: 'testimonials', label: 'Open Success Stories' }],
    ur: 'Asli kahaniyan trust jaldi banati hain, lekin sirf client ki ijazat se aur unke documents/private maloomat ke baghair. Marketing → Success Stories mein approved cases hain.',
  },
  {
    id: 'urgent', kind: 'sales', title: 'The client needs the visa urgently',
    q: 'urgent emergency fast quickly next week travel soon short notice jaldi urgent visa asap abhi chahiye',
    answer: 'Be careful: urgency is where promises get broken. Check what is realistic first.',
    steps: ['Ask the exact travel date and why it is fixed.', 'Check the embassy’s current appointment availability and processing time with your manager — do not guess.', 'Tell them clearly that nobody can control the decision time.', 'Advise them not to buy non-refundable tickets before the decision.', 'If the date is not realistic, say so now and offer a better date.'],
    say: 'I understand it is urgent, {name}. I will check the current appointment availability and processing time today and tell you honestly what is possible. Please do not buy non-refundable tickets until the visa is issued.',
    ur: 'Jaldi mein wade toot jate hain. Pehle sach check karein: safar ki tareekh, maujooda appointment/processing time (manager se), aur saaf batayein ke faisle ka waqt koi control nahi kar sakta. Non-refundable ticket na khareedne ka kahein.',
  },
  {
    id: 'firsttime', kind: 'sales', title: 'First-time traveller with no travel history',
    q: 'first time traveller no travel history never travelled before first visa no stamps pehli baar safar travel history nahi',
    answer: 'It is not a refusal reason by itself, but the file has to work harder: a clear purpose, a believable plan and strong ties.',
    steps: ['Start with a modest, easy-to-believe trip (a short visit, not a long one).', 'Make the cover letter explain the purpose, dates, who pays and why they return.', 'Show strong ties: job or business, family, property.', 'Be honest with the client if the profile is thin — sometimes it is better to build a travel record first.'],
    ur: 'Pehli baar safar refusal ki wajah nahi, magar file ko zyada mazboot hona chahiye: saaf maqsad, yaqeen-bakhsh plan, aur mazboot ties (job/business, family, jaidad). Cover letter mein sab wazeh likhein. Profile kamzor ho to honestly batayein.',
  },
  {
    id: 'selfemp', kind: 'sales', title: 'Self-employed or business documents',
    q: 'self employed business owner shopkeeper own business documents ntn registration business bank statement company letter karobar business wala',
    answer: 'A person who runs a business has to prove the business is real and earns regularly.',
    steps: ['Business registration, NTN and tax returns, if they have them.', 'Business and personal bank statements for the last six months, with income that matches the business.', 'Shop/office proof: photos, rent agreement or ownership papers, utility bills.', 'A short letter on business letterhead stating the activity and their role in it.', 'Explain any big deposits in the cover letter.', 'Check the country’s own checklist too — different embassies ask for different extras.'],
    ur: 'Karobari shakhs ko saabit karna hota hai ke karobar asli hai aur musalsal kamata hai: registration/NTN/tax returns, 6 mahine ke business aur personal bank statements, dukan/office ka saboot, letterhead par chhota letter, aur bade deposits ki wazahat cover letter mein.',
    follow: ['Documents for UK', 'Bank statement problem'],
  },
  {
    id: 'sponsored', kind: 'sales', title: 'Student, housewife, retired or unemployed — who sponsors?',
    q: 'sponsor sponsored student housewife retired unemployed no job no income dependent father pays kharcha koi aur uthaye ghar ki khatoon sponsorship',
    answer: 'When the applicant has no income, someone else’s income and relationship has to be shown clearly — and the applicant’s own ties still matter.',
    steps: ['Ask who is paying and how they are related.', 'The sponsor’s documents: ID, job/business proof, six months of bank statements, and a sponsorship letter.', 'Proof of the relationship (e.g. family registration certificate).', 'The applicant’s own ties: studies, family, home.', 'Be honest: a sponsor helps with funds, but does not replace the applicant’s reasons to return.'],
    go: [{ tab: 'letters', label: 'Letters & Certificates' }],
    ur: 'Jab applicant ki apni amdan na ho to sponsor ke documents (ID, job/business saboot, 6 mahine ki statement, sponsorship letter) aur rishte ka saboot dikhana hota hai. Sponsor funds mein madad karta hai, lekin applicant ke apne wapas aane ke wajoohat phir bhi zaroori hain.',
  },
  {
    id: 'invitation', kind: 'sales', title: 'Invitation or sponsor letter — what must it contain?',
    q: 'invitation letter sponsor letter host friends family abroad inviting letter of invitation statement of sponsorship kya likhna hai dawat nama',
    answer: 'A good invitation is specific and verifiable. Never write one on the client’s behalf with invented details.',
    steps: ['Full details of the host: name, address, phone, status in the country, and a copy of their ID or residence proof.', 'Relationship to the applicant and why they are visiting.', 'Dates of stay and where the visitor will stay.', 'Who pays for the trip (the host or the applicant).', 'Host’s signature and date. Only true statements — embassies check.'],
    ur: 'Dawat nama tafseeli aur check hone ke qabil hona chahiye: host ka poora naam/pata/status aur ID ki copy, rishta, wajah, ruknay ki tareekhein aur jagah, kharcha kaun uthayega, aur dastakhat. Sirf sach likhein.',
  },
  {
    id: 'multicountry', kind: 'sales', title: 'Which country should I suggest?',
    q: 'which country best choose suggest recommend easy easiest visa where should client go many countries confused kaun sa mulk behtar konsa country mashwara',
    answer: 'Recommend by the client’s purpose and profile, not by what is easiest to sell. The right country is the one the officer will believe.',
    steps: ['Start from the purpose: family visit, tourism, business, study, work.', 'Check their profile: travel history, income, ties, any refusals.', 'A first-time traveller often does better with a shorter, simpler trip first.', 'Never apply to a different embassy only because it is “easier” — a mismatch is a classic refusal reason.', 'Ask your manager or the specialist desk (UK, Europe, Australia/US/Canada) if you are unsure.'],
    ur: 'Mulk client ke maqsad aur profile ke mutabiq suggest karein, asaan bechne ke mutabiq nahi. "Asaan" embassy chun kar apply karna refusal ki bari wajah hai. Shak ho to manager ya specialist desk se poochein.',
    follow: ['Who handles UK files?', 'What do I tell a Schengen client?'],
  },
  {
    id: 'closing', kind: 'sales', title: 'How to close the sale',
    q: 'close closing convert sale script ready to start sign up how to convert final step commit decision client agrees band karna deal sale close kaise karun',
    answer: 'Closing is simply a clear next step, asked for calmly, once the client’s questions are answered.',
    steps: ['Summarise: what they get, the fee, the timeline.', 'Ask: “Shall we start your file today?”', 'If yes: say the advance amount and what it covers, offer the payment plan.', 'If they hesitate: ask what is still unclear and answer only that.', 'The moment the advance is paid, tell your manager so the case is opened and the payment recorded.'],
    say: 'Based on our conversation, {name}, I think we can prepare a strong {destination} file for you. To get started, the advance is PKR [amount], which covers [what it covers]. We can also split the payment. Shall we begin today?',
    sayUr: 'Hamari baat ke mutabiq {name}, main samajhta hoon ke hum aap ki {destination} ki mazboot file bana sakte hain. Shuru karne ke liye advance PKR [raqam] hai jis mein [kya shamil hai]. Hum payment do hisson mein bhi kar sakte hain. Kya aaj shuru karein?',
    ur: 'Closing sirf agla saaf qadam hai: summary dein (kya milega, fee, timeline), poochein "aaj shuru karein?", haan ho to advance ki raqam aur plan batayein, aur payment aate hi manager ko batayein.',
    follow: ['How do I ask for the advance?', 'What happens after the advance?'],
  },
  {
    id: 'onboarding', kind: 'sales', title: 'What to do after the client pays the advance',
    q: 'after payment advance paid client joined next steps onboarding start file open case welcome payment ho gayi ab kya karun',
    answer: 'The first 24 hours decide whether the client feels looked after.',
    steps: ['Tell your manager immediately so the case file is opened and the payment is recorded (Cases → “+ Add case”).', 'Send the client a welcome message and their document checklist the same day.', 'Give them a clear timeline: documents, appointment, decision.', 'Set the next follow-up to chase the missing documents.', 'Mark the lead Converted.'],
    go: [{ tab: 'cases', label: 'Open Cases' }],
    ur: 'Pehle 24 ghante ahem hain: manager ko foran batayein (case file khulegi aur payment record hogi), usi din welcome message aur checklist bhejein, timeline batayein, missing documents ki follow-up date lagayein, aur lead ko Converted mark karein.',
  },
  {
    id: 'balance', kind: 'sales', title: 'Asking a client for the remaining balance',
    q: 'balance remaining payment baqi raqam pending payment chase client not paid reminder collect wasooli kaise maangein baqaya',
    answer: 'Be polite, specific and early. Most late payments are forgetfulness, not refusal.',
    steps: ['Check the amount and date in the case (the “Payment” plan shows what is due and when).', 'Send a friendly reminder a few days before the date, and another on the day.', 'Say the exact amount, what it is for, and how to pay.', 'If they cannot pay on time, agree a new date and write it in the case.', 'If it is late for long, tell your manager — Finance → Who Owes Us has a one-tap WhatsApp reminder.'],
    say: 'Assalam o Alaikum {name}, a gentle reminder that PKR [amount] for your {destination} file is due on [date]. You can pay by [method]. Please let me know once it is done, and tell me if you need a few more days.',
    sayUr: 'Assalam o Alaikum {name}, yaad dahani ke aap ki {destination} file ki PKR [raqam] [tareekh] ko due hai. Aap [tareeqa] se ada kar sakte hain. Ada ho jaye to bata dein, aur agar kuch din chahiye hon to bhi bata dein.',
    go: [{ tab: 'billing', label: 'Who Owes Us' }],
    ur: 'Narmi se, saaf raqam ke saath aur waqt se pehle yaad dahani karein. Raqam, kis liye, aur kaise dena hai batayein. Time na ho to nayi tareekh case mein likh dein. Zyada late ho to manager ko batayein.',
  },
  {
    id: 'missed', kind: 'sales', title: 'The client missed an appointment or consultation',
    q: 'missed appointment no show did not come consultation absent late cancelled reschedule appointment miss ho gayi client nahi aaya',
    answer: 'Stay calm and helpful: first find out why, then rebook quickly — a missed embassy slot can be costly.',
    steps: ['Call right away, then send a message.', 'Ask what happened without blaming.', 'If it was an embassy appointment, check the rebooking options with your manager the same day.', 'Mark the appointment status in Appointments and write what happened in the case notes.', 'Set a reminder routine for next time: confirm one day before and the morning of.'],
    go: [{ tab: 'appointments', label: 'Open Appointments' }],
    ur: 'Pehle call, phir message; wajah poochein, ilzam na dein. Embassy appointment thi to usi din manager se rebooking ke options check karein. Appointments mein status badlein aur notes likhein. Agli baar ek din pehle aur subah confirm karein.',
  },
  {
    id: 'notes', kind: 'sales', title: 'What should I write in the lead notes?',
    q: 'notes what to write lead notes log remarks history record conversation notes kya likhun remarks',
    answer: 'Write what the next person needs to continue the conversation without asking again.',
    steps: ['What the client said — purpose, dates, worries, budget.', 'What you promised (a call, a document list) and by when.', 'Their objection, in their own words.', 'Anything personal that builds the relationship (a family event, the reason for travel).', 'Then set the next follow-up date.'],
    ur: 'Wohi likhein jo agle banday ko dobara poochne se bachaye: client ne kya kaha (maqsad, tareekh, fikar, budget), aap ne kya wada kiya aur kab tak, unka etraz unhi ke alfaz mein, aur phir agli follow-up date.',
  },
  {
    id: 'sendwa', kind: 'sales', title: 'The client says “send me the details on WhatsApp”',
    q: 'send details whatsapp send me details just send message brochure information send info bhej dein details whatsapp par bhejo',
    answer: 'It is a polite way of ending the call — turn it into the next step. Send something useful and agree on a callback.',
    steps: ['Send a short message: the process in 3 lines, the document list for their country, and the fee structure.', 'Finish with one easy question and a callback time.', 'Set the follow-up for tomorrow.'],
    say: 'Of course, {name}. Here is a quick summary: [process in 3 lines]. Documents usually needed: [list]. Our fee has three parts: consultation, service fee and the embassy fee (passed on). I will call you tomorrow at [time] to answer any questions — is that fine?',
    ur: 'Yeh aksar baat khatam karne ka narm tareeqa hota hai. Process ke 3 lines, mulk ki document list aur fee structure bhejein, aur ek asaan sawal ke saath callback ka waqt tay karein. Kal ki follow-up date lagayein.',
  },
  {
    id: 'refundreq', kind: 'sales', title: 'The client asks for a refund',
    q: 'refund money back return payment cancel want refund paisay wapas wapsi cancel karna chahta hai',
    answer: 'You cannot promise or refuse a refund yourself. Listen, stay calm, and bring your manager in the same day.',
    steps: ['Let the client finish and repeat their concern back to them.', 'Do not argue about the policy, and do not promise anything.', 'Tell them your manager will call them today.', 'Tell your manager the facts: what was paid, what work was done, and the client’s reason.', 'Record everything in the case notes.'],
    ur: 'Refund ka wada ya inkar aap khud nahi kar sakte. Poori baat sunein, bahes na karein, aur usi din manager ko shamil karein. Manager ko hakeeqat batayein: kitna ada hua, kitna kaam hua, client ki wajah. Sab case notes mein likhein.',
  },
  {
    id: 'revive', kind: 'sales', title: 'Reviving old or cold leads',
    q: 'old leads cold leads revive reactivate dead leads purane leads wapas laana lost leads reopen win back inactive',
    answer: 'Old leads are not dead leads. A helpful, low-pressure message every few weeks brings some of them back.',
    steps: ['Filter your leads for those quiet for 10+ days (the Sales Coach lists them as “Quiet for N days”).', 'Send something useful, not “are you interested?” — a checklist, a deadline, a rule change.', 'Ask one easy question about their plans.', 'Reset the follow-up date after every try.', 'If they say stop, stop — mark Lost with that reason.'],
    say: 'Hello {name}, I hope you are well. I was reviewing {destination} files and thought of you. Are you still planning to travel? If your plans changed, tell me and I will advise what is best now.',
    sayUr: 'Assalam o Alaikum {name}, umeed hai khairiyat se hon ge. Main {destination} ki files dekh raha tha to aap ka khayal aaya. Kya aap abhi bhi safar plan kar rahe hain? Plan badal gaya ho to bata dein, main behtareen mashwara doonga.',
    go: [{ tab: 'coach', label: 'Open Sales Coach' }],
    ur: 'Purane leads mare hue nahi hote. Har kuch hafton baad kaam ki baat bhejein (checklist, deadline, rule change), ek asaan sawal poochein, aur har koshish ke baad follow-up date dobara lagayein. Client "bas" kahe to ruk jayein.',
  },
  {
    id: 'routine', kind: 'sales', title: 'My daily routine as a sales agent',
    q: 'daily routine day plan schedule habits what should i do every day morning checklist routine roz kya karna hai din ka plan',
    answer: 'Five habits make a good month.',
    steps: ['Reply to every new lead within 15 minutes.', 'Contact the leads whose follow-up is due today (open Sales Coach → “My next actions”).', 'Post one WhatsApp Status.', 'Ask one happy client for a review or a referral.', 'End the day with a follow-up date on every open lead.'],
    go: [{ tab: 'coach', label: 'My next actions' }],
    ur: 'Paanch aadatein: har naye lead ko 15 minute mein jawab; aaj due follow-ups; ek WhatsApp Status; ek khush client se review/referral; aur din ke end par har open lead par follow-up date.',
    follow: ['What should I do today?', 'How can I hit my monthly target?'],
  },
  {
    id: 'target', kind: 'sales', title: 'How can I hit my monthly target?',
    q: 'target quota goal monthly cases close more increase sales improve performance hit target kaise poora karun zyada cases kaise karun',
    answer: 'Targets are met by habits, not by luck: speed, follow-up discipline and referrals.',
    steps: ['Look at your numbers in My Portal: leads, cases closed, quota.', 'Work backwards: how many consultations do you need to close your cases? Book that many.', 'Fix the leaks: new leads untouched, follow-ups overdue, qualified clients not asked for the advance.', 'Ask every closed client for a review and a referral.', 'Share with your manager what is blocking you.'],
    go: [{ tab: 'myportal', label: 'My Portal' }],
    ur: 'Target aadat se poora hota hai: tezi, follow-up ki discipline aur referrals. My Portal mein apne numbers dekhein, ulta hisab lagayein ke kitni consultations chahiye, leaks theek karein (untouched leads, overdue follow-ups, advance na maangna), har closed client se referral maangein.',
  },
  {
    id: 'escalate', kind: 'sales', title: 'When should I pass a lead to my manager?',
    q: 'escalate manager help pass lead handover senior complicated difficult case when to escalate upar bhejna manager ko batana',
    answer: 'Escalate early, with the facts. Do not wait until the client is unhappy.',
    steps: ['The client asks for a refund, a guarantee, a discount or a legal opinion.', 'A previous refusal, overstay or anything you are unsure about.', 'The client is upset or threatens to complain.', 'Large or family files that need a plan.', 'Use the “Escalate” button on the lead and write the reason, so the manager sees it at once.'],
    ur: 'Jald aur hakeeqat ke saath escalate karein: refund/guarantee/discount ki maang, pehla refusal ya overstay, naraz client, bari ya family files. Lead par "Escalate" button dabayein aur wajah likhein.',
  },
  {
    id: 'stop', kind: 'sales', title: 'The client says “do not call me again”',
    q: 'stop calling do not call not interested remove me block unsubscribe leave me alone dobara call na karna interested nahi',
    answer: 'Respect it. Thank them, stop contacting them, and record the reason.',
    steps: ['Reply politely: thank them and say you will not contact them again.', 'Mark the lead Lost with the reason “asked to stop”.', 'Remove them from any broadcast list.'],
    say: 'Understood, {name}. Thank you for your time, and I wish you all the best. If you ever need help with a visa, you are always welcome to message us.',
    ur: 'Izzat se maan lein. Shukriya keh kar contact band karein, lead ko Lost mark karein (wajah: "asked to stop"), aur broadcast list se nikal dein.',
  },
  {
    id: 'discount', kind: 'sales', title: 'Can I give a discount?',
    q: 'discount offer reduce price special rate concession waive can i give discount agree kam kar sakta hun discount dena',
    answer: 'Not on your own. Discounts are agreed with your manager first, and recorded in the case (discount amount and reason) so the books stay correct.',
    steps: ['Ask your manager before you promise anything.', 'Offer value or a payment plan first — it often solves the real problem.', 'If a discount is approved, it is entered on the case with the reason; the invoice and Finance follow automatically.'],
    ur: 'Apni marzi se nahi. Discount manager se pehle tay hota hai aur case mein raqam aur wajah ke saath likha jata hai. Pehle value ya payment plan offer karein, aksar wohi asal masla hota hai.',
  },
  {
    id: 'objection-timing', kind: 'sales', title: '“I will apply later” or “not the right season”',
    q: 'apply later wait season next year not now postpone delay later on baad mein abhi nahi agle saal',
    answer: 'Sometimes waiting is right; sometimes it is just hesitation. Find out which.',
    steps: ['Ask what they are waiting for (funds, leave, passport, results, a date).', 'If it is real, agree the date and set the follow-up for then.', 'If it is hesitation, remind them that appointments get scarce and that a complete file takes time to build.', 'Never push them to apply before they are ready — a refusal costs more than waiting.'],
    ur: 'Poochein ke kis cheez ka intezar hai. Asli wajah ho to tareekh tay karein aur follow-up date lagayein; sirf hichkichahat ho to yaad dilayein ke appointments kam hote hain aur mukammal file banne mein waqt lagta hai. Taiyari se pehle apply karwana theek nahi.',
  },
];

const PORTAL: Entry[] = [
  {
    id: 'p-newlead', kind: 'portal', title: 'How do I add a lead?',
    q: 'add lead new lead create lead enter enquiry manually register lead naya lead kaise banayen lead add karna',
    answer: 'Open Marketing → Leads and press “+ New lead”. Fill in the name, phone, country and where it came from, then “Save lead”.',
    steps: ['Sidebar → Marketing → Leads.', 'Press “+ New lead”.', 'Fill in name, phone, destination and source.', 'Press “Save lead”, then set the next follow-up date.'],
    go: [{ tab: 'leads', label: 'Open Leads' }],
  },
  {
    id: 'p-followdate', kind: 'portal', title: 'How do I set a follow-up date or change a lead’s stage?',
    q: 'set follow up date change stage move lead converted lost contacted qualified update lead status next follow up date lagana stage badalna',
    answer: 'Open the lead from Marketing → Leads. Change the stage (New → Contacted → Qualified → Converted or Lost) and pick the next follow-up date. If you mark a lead Lost, write the reason and press “Save reason”.',
    steps: ['Marketing → Leads → open the lead.', 'Change the stage as the conversation moves.', 'Choose the next follow-up date — every open lead should have one.', 'Add what the client said to the log with “Add to log”.'],
    go: [{ tab: 'leads', label: 'Open Leads' }],
  },
  {
    id: 'p-wa', kind: 'portal', title: 'How do I message a lead on WhatsApp from the portal?',
    q: 'whatsapp message lead button send whatsapp from portal chat open wa link ready message whatsapp kaise bhejun',
    answer: 'On a lead, use the WhatsApp button: it opens the chat with a ready message for that lead’s next step. In Sales Coach → “My next actions”, every lead has a WhatsApp button and a “Copy message” button too.',
    go: [{ tab: 'coach', label: 'My next actions' }],
  },
  {
    id: 'p-addcase', kind: 'portal', title: 'How do I open a new case?',
    q: 'add case new case create case open file register client case enter case start file naya case kaise banayen case file kholna',
    answer: 'Open Cases & Clients → Cases and press “+ Add case”. Choose the country and visa type, enter the fees, who closed it and when. Every case gets its own query number (GG01, GG02…) by itself.',
    steps: ['Sidebar → Cases & Clients → Cases.', 'Press “+ Add case”.', 'Fill in the client, country, visa type and fees.', 'For a family or group, choose the family/group file and add every member.', 'Optionally add the file to a group tour from the same form.', 'Save — the query number is given automatically.'],
    go: [{ tab: 'cases', label: 'Open Cases' }],
  },
  {
    id: 'p-payment', kind: 'portal', title: 'How do I record a payment from a client?',
    q: 'record payment client paid received advance balance mark paid enter payment how much received payment entry paisay mile payment kaise likhun advance receive',
    answer: 'Open the case in Cases → open the file, then use “Payment” (or “Mark advance paid” / “Mark balance paid”). The amount goes into Received automatically — you do not need to add it in Finance as well.',
    steps: ['Cases → open the client’s file.', 'Press “Payment” and enter the amount received (the date, and what it was for).', 'The case’s “still owed” updates, and the money appears under Received in Finance → Overview.', 'Print the receipt if the client wants one.'],
    go: [{ tab: 'cases', label: 'Open Cases' }, { tab: 'money', label: 'Finance Overview' }],
  },
  {
    id: 'p-family', kind: 'portal', title: 'How do I make a family or group file?',
    q: 'family file group file add family members head of family spouse children one case many applicants khandan ki file family case',
    answer: 'In “+ Add case”, choose the family / group file and add every member under the head of family. It stays one case with one invoice. You can add the whole family to a group tour from the same form.',
    go: [{ tab: 'cases', label: 'Open Cases' }, { tab: 'grouptours', label: 'Group Tours' }],
  },
  {
    id: 'p-tour', kind: 'portal', title: 'How do I add a client to a group tour?',
    q: 'group tour add client add traveler register tour member family to tour package tour qr tour mein shamil karna',
    answer: 'Two ways: in the case form press “Add to tour”, or open Group Tours and use “+ From a case / family” (it brings the whole family in) or “+ Add traveler”.',
    go: [{ tab: 'grouptours', label: 'Open Group Tours' }],
  },
  {
    id: 'p-queryno', kind: 'portal', title: 'What is a query number?',
    q: 'query number GG01 gg query no reference number referral query number case number kya hai queryno',
    answer: 'Every case gets the next number in order — GG01, GG02, GG03… — when it is created. If a new client was recommended by an old one, pick the old client’s query number on the new case as “referred by”, so the referral is linked.',
    go: [{ tab: 'cases', label: 'Open Cases' }],
  },
  {
    id: 'p-appt', kind: 'portal', title: 'How do I book an appointment?',
    q: 'book appointment schedule appointment embassy date consultation meeting add appointment appointment kaise lagayen',
    answer: 'Open Cases & Clients → Appointments and press “+ Book appointment”. Choose the client, date, time and type. Today’s appointments also show on the home screen under “Needs you today”.',
    go: [{ tab: 'appointments', label: 'Open Appointments' }],
  },
  {
    id: 'p-invoice', kind: 'portal', title: 'How do I print an invoice or receipt?',
    q: 'invoice generate invoice receipt print pdf bill client invoice banana receipt nikalna',
    answer: 'Open the case in Cases and press “Generate invoice” (or “Print / Save as PDF”). Document receipts are in Client Documents → “Receipt”.',
    go: [{ tab: 'cases', label: 'Open Cases' }],
  },
  {
    id: 'p-expense', kind: 'portal', title: 'How do I add an expense?',
    q: 'add expense record expense spent rent bill salary office cost enter expense kharcha likhna expense kaise add karun',
    answer: 'Go to Finance → Books & Banks → Entries and press “+ Add expense”. Choose the date, amount, category and who you paid. Embassy fees listed on a client’s case are added to expenses by themselves on their date — do not add them twice. Salaries come from Payroll when you press “Pay all staff”.',
    go: [{ tab: 'accounts', label: 'Books & Banks' }],
    headOnly: true,
  },
  {
    id: 'p-owes', kind: 'portal', title: 'Where do I see who owes us money?',
    q: 'who owes us pending payments balance due late clients outstanding receivables collection reminders unpaid kis ne paisay dene hain baqaya',
    answer: 'Finance → Who Owes Us lists every client with a balance, how late they are, and has a one-tap “WhatsApp reminder”. The total also shows as “Clients still owe” on the Finance overview.',
    go: [{ tab: 'billing', label: 'Who Owes Us' }],
    headOnly: true,
  },
  {
    id: 'p-monthend', kind: 'portal', title: 'How do I close the month?',
    q: 'close month month end closing lock month monthly closing carry forward reopen month end kaise karun mahina band',
    answer: 'Finance → Month-End. Check that the month looks right, lock it, and the balance clients still owe carries forward to the next month. If you must change something later, “Reopen month”. Last month should be closed by the 5th.',
    go: [{ tab: 'closing', label: 'Open Month-End' }],
    headOnly: true,
  },
  {
    id: 'p-payroll', kind: 'portal', title: 'How do I run payroll?',
    q: 'payroll pay salary salaries payslip approve payroll pay staff advance deduction bonus commission run pay run tankhwah salary kaise dena',
    answer: 'HR → Payroll. Create the month’s pay run, check each person’s pay (“Edit pay” for changes), then “Approve payroll” and “Pay all staff”. Salary for a month is paid on the 5th of the next month. “Payslip” and “Print all payslips” make the slips; “Download bank transfer sheet” gives the bank file. An advance is given with “+ Give an advance”.',
    go: [{ tab: 'payroll', label: 'Open Payroll' }],
    headOnly: true,
  },
  {
    id: 'p-attendance', kind: 'portal', title: 'How do I mark my attendance?',
    q: 'check in check out attendance mark attendance duty time late absent shift hazri attendance kaise lagaun',
    answer: 'Open My Portal and press “Check in now” when you start and “Check out now” when you finish. Late arrivals and absences are tracked automatically against your shift.',
    go: [{ tab: 'myportal', label: 'My Portal' }],
  },
  {
    id: 'p-leave', kind: 'portal', title: 'How do I ask for leave or a salary advance?',
    q: 'leave request holiday day off salary advance apply for leave submit request time off chutti advance maangna',
    answer: 'In My Portal press “+ Submit request”, choose Leave or Salary advance, fill the dates and details, and “Submit”. Your Head Manager sees it under “Needs you today” and answers it.',
    go: [{ tab: 'myportal', label: 'My Portal' }],
  },
  {
    id: 'p-complaint', kind: 'portal', title: 'How do I log a client complaint?',
    q: 'complaint log complaint client unhappy feedback issue resolve escalate shikayat darj karna',
    answer: 'Cases & Clients → Complaints & Feedback → “+ Log a complaint”. Choose the severity and who handles it; update the status as it moves to In progress, Escalated or Resolved.',
    go: [{ tab: 'complaints', label: 'Complaints & Feedback' }],
  },
  {
    id: 'p-referral', kind: 'portal', title: 'How do I add a referral partner?',
    q: 'referral agent partner commission add agent external agent percent pay commission referral partner banana',
    answer: 'Cases & Clients → Referral Agents → “+ Add referral agent”. On a case, choose the agent and the commission percent; “Pay referral commission” records the payout in Expenses.',
    go: [{ tab: 'referralagents', label: 'Referral Agents' }],
  },
  {
    id: 'p-docs', kind: 'portal', title: 'How do I record an original document we received?',
    q: 'receive document original passport received held submitted returned client documents register document receipt dastavez wasool',
    answer: 'Cases & Clients → Client Documents → “+ Receive a document”. Mark it “Sent to embassy” when it goes out and “Return to client” when it comes back; “Save and print receipt” gives the client a receipt.',
    go: [{ tab: 'clientdocs', label: 'Client Documents' }],
  },
  {
    id: 'p-qc', kind: 'portal', title: 'What is Quality Control and how do I use it?',
    q: 'quality control qc checklist pre submission check file before embassy review case pass fail quality check',
    answer: 'Quality & Team → Quality Control: a checklist for every case before it goes to the embassy. Tick the points, add your own with “Add point”, and “Save check”. Each case keeps a pass / fail history.',
    go: [{ tab: 'qc', label: 'Quality Control' }],
  },
  {
    id: 'p-messages', kind: 'portal', title: 'How do I message a colleague privately?',
    q: 'team messages chat private message colleague send message to staff inbox unread message bhejna',
    answer: 'Quality & Team → Team Messages: pick the person and write to them. It is one-to-one and private; unread messages show a count.',
    go: [{ tab: 'messages', label: 'Team Messages' }],
  },
  {
    id: 'p-announce', kind: 'portal', title: 'How do I post an announcement to the team?',
    q: 'announcement notice post announcement team notice board pin message everyone ilan',
    answer: 'HR → Announcements → “+ New announcement”. Choose the audience (everyone or a department) and pin it if it is important. Employees see it at the top of their portal.',
    go: [{ tab: 'announcements', label: 'Announcements' }],
    headOnly: true,
  },
  {
    id: 'p-source', kind: 'portal', title: 'How do I connect a Facebook / Instagram lead form?',
    q: 'lead source google sheet facebook form instagram form sync leads from sheet connect ad form add lead source auto import leads ad leads kaise aayen',
    answer: 'Marketing → Lead Sources → “+ Add lead source”. Paste the Google Sheet link (shared as “Anyone with the link”), choose the country and campaign. New leads arrive on their own every few minutes and are counted per form.',
    go: [{ tab: 'leadsources', label: 'Lead Sources' }],
    headOnly: true,
  },
  {
    id: 'p-campaign', kind: 'portal', title: 'How do I record ad spend for a campaign?',
    q: 'campaign ad spend budget log payment close campaign marketing cost facebook ads dollars campaign banana ad kharcha',
    answer: 'Marketing → Campaigns → “+ Add campaign”, then “Log payment” each time you pay for ads (US dollars are converted to PKR with tax and posted to Expenses by themselves). “Close campaign” when it ends.',
    go: [{ tab: 'campaigns', label: 'Campaigns' }],
    headOnly: true,
  },
  {
    id: 'p-pricing', kind: 'portal', title: 'Where do I set or check fees by country?',
    q: 'pricing rate card fees by country consultation fee service fee appointment fee set price rates fee kahan se dekhun',
    answer: 'Cases & Clients → Pricing by Country. Add or change a rate with “+ Add new rate” and “Save rate”. The case form can use these rates.',
    go: [{ tab: 'pricing', label: 'Pricing by Country' }],
  },
  {
    id: 'p-employee', kind: 'portal', title: 'How do I add an employee or reset a PIN?',
    q: 'add employee new staff reset pin forgot pin hire team member create staff account employee banana pin bhool gaya',
    answer: 'HR → HR Department → “+ Add employee”. For a forgotten PIN, open the person and press “Reset PIN”. The same screen holds their contract, pay and countries they are an expert in.',
    go: [{ tab: 'hr', label: 'HR Department' }],
    headOnly: true,
  },
  {
    id: 'p-desk', kind: 'portal', title: 'How do specialty desks work (UK / Europe / Australia, US & Canada)?',
    q: 'specialty desk specialist expert uk desk europe desk assign auto assign country expert team country wise',
    answer: 'On an employee’s profile you can mark the countries they are an expert in. New leads are suggested (and auto-assigned) to the best-fit specialist with the lightest workload. Nothing is blocked: anyone can still take any file; the desks only decide who is suggested first.',
    go: [{ tab: 'hr', label: 'HR Department' }],
  },
  {
    id: 'p-daily', kind: 'portal', title: 'What is the Daily Report?',
    q: 'daily report whatsapp report summary evening report head operations daily summary report send',
    answer: 'A one-message summary of your whole business, sent on WhatsApp every evening. Set it up, preview it and see the history on the Daily Report page (Head Manager).',
    go: [{ tab: 'dailyreport', label: 'Daily Report' }],
    headOnly: true,
  },
  {
    id: 'p-coach', kind: 'portal', title: 'What can I do in the Sales Coach?',
    q: 'sales coach what is coach tabs next actions follow up steps posts marketing routine coach kya hai',
    answer: 'Marketing → Sales Coach has: My next actions (who to contact now, with a ready message), Follow-up steps, Convert a lead, Marketing routine, Posts (a ready-made post every day) and this assistant.',
    go: [{ tab: 'coach', label: 'Open Sales Coach' }],
  },
  {
    id: 'p-export', kind: 'portal', title: 'How do I export to Excel / CSV?',
    q: 'export csv excel download spreadsheet save list data export karna download karna',
    answer: 'Most lists (Leads, Cases, the ledger in Books & Banks) have an “Export CSV” button. It downloads what you currently see, so apply the filter first.',
  },
  {
    id: 'p-sheet', kind: 'portal', title: 'Which screen should I use for what?',
    q: 'which screen where is what where to find overview navigation modules menu guide kahan hai screens kaun si screen',
    answer: 'Marketing = leads and ads. Cases & Clients = files, appointments, referral partners, complaints, documents, pricing. HR = team, payroll, attendance. Finance = overview, who owes us, money going out, profit, month-end, books. Quality & Team = checks and messages. Use “Ask the assistant” anywhere if you cannot find something.',
  },
];

const MONEY: Entry[] = [
  {
    id: 'm-four', kind: 'money', title: 'Finance in one minute — the four numbers',
    q: 'finance confusing explain finance understand money overview four numbers simple how to read finance finance samajh nahi aata paisay ka hisab received spent kept owed',
    answer: 'Everything in Finance is built from four plain numbers:\nReceived = cash that actually arrived in the month.\nSpent = cash that actually left.\nWhat we kept = Received − Spent.\nClients still owe = money clients have not paid yet — it is NOT in Received until they pay.',
    steps: ['Start at Finance → Overview: it shows the four numbers for the month, with a short story in plain words.', 'To collect: Who Owes Us. To pay: Money Going Out.', 'To see how healthy the month was: Profit & Growth.', 'When the month is done: Month-End locks it.', 'Every individual entry lives in Books & Banks.'],
    ur: 'Finance chaar seedhay numbers se bana hai: Received (jo cash asal mein aaya), Spent (jo cash asal mein gaya), What we kept = Received − Spent, aur Clients still owe (jo clients ne abhi ada nahi kiya — jab tak ada na karein Received mein shamil nahi). Overview se shuru karein.',
    go: [{ tab: 'money', label: 'Finance Overview' }],
    follow: ['What is the difference between sold and received?', 'Why are embassy fees counted as spent?'],
  },
  {
    id: 'm-sold', kind: 'money', title: 'What is the difference between “sold” and “received”?',
    q: 'sold vs received booked revenue difference file value cash basis fee amount paid sales revenue difference kitna becha kitna mila',
    answer: '“Sold” (booked value) is the fee we agreed on the files we opened; “Received” is the cash that actually reached us. Finance counts cash: a PKR 100,000 file with PKR 40,000 paid shows 40,000 in Received and 60,000 under “Clients still owe”.',
    ur: '"Sold" woh fee hai jo files par tay hui; "Received" woh cash hai jo asal mein mili. Finance cash ginta hai: 100,000 ki file par 40,000 mile to Received mein 40,000 aur "Clients still owe" mein 60,000 nazar aayenge.',
    go: [{ tab: 'money', label: 'Finance Overview' }],
  },
  {
    id: 'm-passthrough', kind: 'money', title: 'Why do embassy fees count as money spent?',
    q: 'embassy fee pass through spent expense profit why client money embassy appointment fee counted pass-through fee embassy ka kharcha',
    answer: 'When a client pays an embassy fee to us and we pay it on to the embassy, the money comes in AND goes out. Both appear (in Received and in Spent), so What we kept is not inflated by money that was never ours. Profit & Growth shows this separately as “money that is not profit”.',
    go: [{ tab: 'profit', label: 'Profit & Growth' }],
  },
  {
    id: 'm-kept', kind: 'money', title: 'What does “What we kept” mean? Is it profit?',
    q: 'what we kept profit net profit meaning how much profit kept earnings margin net earn kitna bacha',
    answer: 'Yes — it is the net profit for the month in plain words: Received minus Spent. Money clients still owe is kept separate so it never confuses this number.',
    go: [{ tab: 'profit', label: 'Profit & Growth' }],
  },
  {
    id: 'm-late', kind: 'money', title: 'What does “late” mean in Finance?',
    q: 'late overdue payment promised date passed meaning overdue clients late kya hota hai',
    answer: 'A payment is late when the date the client promised (or the date on their payment plan) has passed and they have not paid. Money with no date at all is shown as “no date set” — ask the client for one.',
    go: [{ tab: 'billing', label: 'Who Owes Us' }],
  },
  {
    id: 'm-closing', kind: 'money', title: 'Why close a month?',
    q: 'why close month purpose month end closing lock carry forward meaning reopen close karne ka faida',
    answer: 'Closing freezes the month’s numbers so they cannot change by accident, and carries what clients still owe into the next month. A month should be closed by the 5th of the next one.',
    go: [{ tab: 'closing', label: 'Month-End' }],
  },
];

const DEFINE: Entry[] = [
  { id: 'd-coverletter', kind: 'define', title: 'What is a cover letter?', q: 'cover letter covering letter what is cover letter write cover letter purpose letter statement', answer: 'A short letter to the officer that tells the whole story in one page: who the applicant is, the purpose and dates of the trip, who pays, and why they will return home. A good cover letter matches every document in the file.', ur: 'Cover letter officer ke naam ek safha ka khat hai: applicant kaun hai, safar ka maqsad aur tareekhein, kharcha kaun uthayega, aur wapas kyun aayega. File ke har document se milta hona chahiye.' },
  { id: 'd-noc', kind: 'define', title: 'What is an NOC / leave letter?', q: 'noc no objection certificate leave letter employer letter job letter employment letter experience letter', answer: 'A letter from the employer saying the person is employed (job title, salary, since when) and that leave has been approved for the travel dates. It is one of the main proofs of ties to Pakistan for employed applicants.', ur: 'NOC/leave letter employer ka khat hai jis mein job, salary, kab se, aur safar ki tareekhon ki chhutti ki manzoori likhi hoti hai. Mulazim applicants ke liye wapas aane ka bara saboot.' },
  { id: 'd-ties', kind: 'define', title: 'What are “ties” to home?', q: 'ties home country ties strong ties weak ties return reasons why return bonds', answer: 'Reasons that make a person likely to come back: a job or business, family (spouse, children, parents), property, studies, and a record of returning from earlier trips. Officers refuse many applications because ties look weak.', ur: 'Ties woh wajoohat hain jo wapas aane ka yaqeen dilayein: job/business, family, jaidad, taleem aur pehle ke safar se wapsi. Kamzor ties refusal ki sab se aam wajah hain.' },
  { id: 'd-biometrics', kind: 'define', title: 'What are biometrics?', q: 'biometrics fingerprints photo visa centre appointment biometric enrolment', answer: 'Fingerprints and a photo taken at the visa application centre. Many countries need them for every application; they are done at an appointment and are part of the file.' },
  { id: 'd-frc', kind: 'define', title: 'What is an FRC / family registration certificate?', q: 'frc family registration certificate nadra family tree relationship proof nikah nama marriage certificate birth certificate', answer: 'A NADRA document that lists a family and shows the relationships between its members. It is commonly used as proof of relationship, along with marriage and birth certificates.' },
  { id: 'd-itinerary', kind: 'define', title: 'What is an itinerary?', q: 'itinerary travel plan day by day plan hotel booking flight reservation tour plan', answer: 'A day-by-day plan of the trip: where the person will go and stay, and how they travel. Use refundable bookings or reservations that can be cancelled free; do not pay for non-refundable tickets before the decision.' },
  { id: 'd-insurance', kind: 'define', title: 'Do they need travel insurance?', q: 'travel insurance medical insurance schengen insurance cover required insurance policy bima', answer: 'For Schengen it is a requirement, and it must cover the whole area and the whole stay with the required medical cover. For other countries it is strongly advised. Check the embassy’s current rule.' },
  { id: 'd-ds160', kind: 'define', title: 'What is the DS-160?', q: 'ds160 ds-160 us visa form usa application form confirmation page interview', answer: 'The online application form for US non-immigrant visas. After submitting, the applicant keeps the confirmation page and brings it to the interview. Mistakes or false statements on it can cause a refusal.' },
  { id: 'd-214b', kind: 'define', title: 'What is “214(b)”?', q: '214b 214(b) us refusal section 214 usa refused weak ties immigrant intent', answer: 'The US law behind the most common visitor-visa refusal: the officer was not satisfied that the person intends to return home. It is about ties and credibility, not about a missing document.' },
  { id: 'd-cas', kind: 'define', title: 'What are CAS, CoE and I-20?', q: 'cas coe i20 i-20 confirmation of acceptance for studies confirmation of enrolment student admission letter study documents', answer: 'The official admission documents a student visa depends on: a CAS (UK), a CoE (Australia) and an I-20 (USA, plus the SEVIS fee). The student visa application cannot start without it.' },
  { id: 'd-trv', kind: 'define', title: 'What is a TRV, eTA, ETA, Super Visa?', q: 'trv eta eta etA super visa temporary resident visa visitor visa canada electronic travel authorization', answer: 'Canadian words: a TRV is the visitor visa; an eTA is an electronic permission for people from visa-exempt countries (not usually for Pakistani passports — check the eligibility tool); the Super Visa lets parents and grandparents of a Canadian citizen or permanent resident stay for long visits.' },
  { id: 'd-schengen', kind: 'define', title: 'What is Schengen?', q: 'schengen area countries what is schengen european visa which countries europe states', answer: 'A group of European countries with no border checks between them. One Schengen short-stay visa lets the holder travel in all of them for up to 90 days in any 180-day period. You apply to the country where the person will spend the most time.' },
  { id: 'd-sponsorword', kind: 'define', title: 'What is a sponsor?', q: 'what is sponsor sponsorship meaning guarantor who is sponsor', answer: 'The person or organisation that pays for or supports the trip or the stay. The embassy checks their relationship and their ability to pay, so their documents matter as much as the applicant’s.' },
];

export const ENTRIES: Entry[] = [...fromGuide(), ...SALES, ...PORTAL, ...MONEY, ...DEFINE];
export const ENTRY_BY_ID: Record<string, Entry> = Object.fromEntries(ENTRIES.map(e => [e.id, e]));

// Starter questions shown in the chat, by role.
export const STARTERS_STAFF = ['What should I do today?', 'Which leads need a follow-up?', 'The client says the fee is too high', 'Write a first message for a UK lead', 'What documents for Schengen?', 'How do I record a payment?'];
export const STARTERS_HEAD = ['What needs my attention today?', 'How much have we received this month?', 'Who owes us money?', 'Finance in one minute', 'Who is my top agent this month?', 'What do we have to pay out?'];
