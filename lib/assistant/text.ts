// Reading a question: lower-case, Roman Urdu words turned into the English idea behind them,
// small words dropped, endings trimmed — then a simple search (BM25) over the knowledge.

const PHRASES: [string, string][] = [
  ['kya karun', 'what do'], ['kya karna hai', 'what to do'], ['kya karna chahiye', 'what should do'], ['kaise karun', 'how do'], ['kaise karen', 'how to'], ['kaise kare', 'how to'], ['kese karun', 'how do'],
  ['reply nahi', 'no reply'], ['reply nahin', 'no reply'], ['jawab nahi', 'no reply'], ['jawab nahin', 'no reply'], ['response nahi', 'no reply'], ['call nahi uthata', 'no reply'], ['call nahi utha', 'no reply'], ['phone nahi uthata', 'no reply'],
  ['mehngi hai', 'expensive'], ['mehnga hai', 'expensive'], ['bohat mehngi', 'expensive'], ['bahut mehngi', 'expensive'], ['fees zyada', 'fee expensive'], ['fee zyada', 'fee expensive'], ['kam karo', 'discount'], ['kam kar do', 'discount'],
  ['soch lun', 'think'], ['sochna hai', 'think'], ['soch kar', 'think'], ['baad mein', 'later'], ['baad me', 'later'],
  ['paise dene', 'owe'], ['paisay dene', 'owe'], ['dene hain', 'owe'], ['dena hai', 'owe'], ['paise nahi', 'no money'], ['paisay nahi', 'no money'], ['kitne paise', 'how much money'], ['kitna paisa', 'how much money'], ['kitne paisay', 'how much money'],
  ['kitne din', 'how long'], ['kitna time', 'how long'], ['kitna waqt', 'how long'], ['kab tak', 'how long'],
  ['kaun sa', 'which'], ['kon sa', 'which'], ['kaun si', 'which'], ['kon si', 'which'], ['visa lagwana', 'visa apply'], ['visa lagana', 'visa apply'], ['visa lagwani', 'visa apply'],
  ['follow up', 'followup'], ['follow-up', 'followup'], ['follow ups', 'followup'], ['follow-ups', 'followup'], ['followups', 'followup'],
  ['bank statement', 'bankstatement'], ['bank statements', 'bankstatement'], ['cover letter', 'coverletter'], ['query number', 'queryno'], ['query no', 'queryno'], ['query #', 'queryno'],
  ['what next', 'next step'], ['whats next', 'next step'], ["what's next", 'next step'], ['next action', 'next step'], ['what should i do', 'what do'], ['what do i do', 'what do'], ['how do i', 'how do'], ['how can i', 'how do'], ['how to', 'how do'],
  ['who owes', 'owe'], ['owes us', 'owe'], ['owe us', 'owe'], ['still owe', 'owe'], ['not paid', 'unpaid'], ['has not paid', 'unpaid'], ["hasn't paid", 'unpaid'], ['yet to pay', 'unpaid'], 
  ['group tour', 'grouptour'], ['group tours', 'grouptour'], ['month end', 'monthend'], ['month-end', 'monthend'], ['pay roll', 'payroll'], ['sales coach', 'salescoach'],
  ['urdu mein', 'inurdu'], ['urdu me', 'inurdu'], ['in urdu', 'inurdu'], ['roman urdu', 'inurdu'], ['in english', 'inenglish'], ['english mein', 'inenglish'], ['english me', 'inenglish'],
  ['united kingdom', 'uk'], ['united states', 'usa'], ['new zealand', 'newzealand'], ['saudi arabia', 'saudi'], ['u k', 'uk'], ['u s a', 'usa'], ['us visa', 'usa visa'], ['us embassy', 'usa embassy'], ['us b1', 'usa b1'], ['us b2', 'usa b2'], ['us f1', 'usa f1'],
  ['do it again', 'again'],
  ['how much', 'howmuch'], ['how many', 'howmuch'], ['how long', 'howlong'], ['so far', 'sofar'], ['say that again', 'again'], ['shorter please', 'shorter'], ['make it shorter', 'shorter'], ['more detail', 'moredetail'], ['tell me more', 'moredetail'], ['explain more', 'moredetail'],
];

const WORDS: Record<string, string> = {
  urdu: 'inurdu', english: 'inenglish',
  kya: 'what', kyun: 'why', kyon: 'why', kaise: 'how', kese: 'how', kaisay: 'how', kab: 'when', kahan: 'where', kahaan: 'where', kidhar: 'where', kaun: 'who', kon: 'who',
  kitna: 'howmuch', kitne: 'howmuch', kitni: 'howmuch', mujhe: 'my', mujhay: 'my', mere: 'my', meri: 'my', mera: 'my', hamara: 'our', hamari: 'our', hamare: 'our', apna: 'my', apni: 'my',
  aaj: 'today', abhi: 'now', kal: 'tomorrow', naya: 'new', nayi: 'new', naye: 'new', naai: 'new', purana: 'old', purani: 'old',
  baqi: 'pending', baqaya: 'pending', baqiya: 'pending', baaqi: 'pending', baqayajat: 'pending', wasooli: 'collect', wasuli: 'collect',
  paisay: 'money', paise: 'money', paisa: 'money', raqam: 'money', rakam: 'money', rupay: 'money', rupee: 'money', rupees: 'money', pkr: 'money',
  wapas: 'return', wapsi: 'return', khatam: 'finish', shuru: 'start', madad: 'help', batao: 'tell', bataiye: 'tell', bataein: 'tell', batayen: 'tell', bata: 'tell', dikhao: 'show', dikhaiye: 'show', dikha: 'show',
  likho: 'write', likh: 'write', likhein: 'write', likhen: 'write', banao: 'make', bana: 'make', banaiye: 'make', bhejo: 'send', bhej: 'send', bhejna: 'send', msg: 'message', msgs: 'message', massage: 'message', mesage: 'message',
  dastavez: 'document', kaghaz: 'document', kagzat: 'document', kaghazat: 'document', kaghazaat: 'document', docs: 'document', doc: 'document', paperwork: 'document', papers: 'document',
  mehnga: 'expensive', mehngi: 'expensive', costly: 'expensive', pricey: 'expensive',
  price: 'fee', prices: 'fee', pricing: 'fee', cost: 'fee', costs: 'fee', charge: 'fee', charges: 'fee', fees: 'fee', rate: 'fee', rates: 'fee',
  soch: 'think', sochta: 'think', sochungi: 'think', sochunga: 'think', sochungi_: 'think',
  refused: 'refusal', refuse: 'refusal', refusals: 'refusal', rejected: 'refusal', rejection: 'refusal', reject: 'refusal', denied: 'refusal', denial: 'refusal', inkar: 'refusal',
  ghussa: 'angry', naraz: 'angry', shikayat: 'complaint', complain: 'complaint', complaints: 'complaint',
  khandan: 'family', biwi: 'family', bachay: 'family', bache: 'family', bachon: 'family',
  rishta: 'relation', sath: 'with', saath: 'with', lagao: 'apply', lagwao: 'apply', lagwana: 'apply', apply: 'apply', applying: 'apply', application: 'apply', applications: 'apply',
  followup: 'followup', chase: 'followup', chasing: 'followup', remind: 'remind', reminder: 'remind', reminders: 'remind', yaad: 'remind',
  britain: 'uk', england: 'uk', london: 'uk', amreeka: 'usa', america: 'usa', american: 'usa', states: 'usa', europe: 'schengen', european: 'schengen', france: 'schengen', germany: 'schengen', italy: 'schengen', spain: 'schengen', netherlands: 'schengen', greece: 'schengen', portugal: 'schengen', austria: 'schengen', belgium: 'schengen', switzerland: 'schengen', poland: 'schengen',
  turkey: 'turkiye', türkiye: 'turkiye', istanbul: 'turkiye', dubai: 'uae', emirates: 'uae', abudhabi: 'uae', nz: 'newzealand', aus: 'australia', sydney: 'australia', melbourne: 'australia', toronto: 'canada',
  students: 'student', study: 'student', studies: 'student', studying: 'student', work: 'work', job: 'work', jobs: 'work', working: 'work',
  tourist: 'visit', tourism: 'visit', visitor: 'visit', visiting: 'visit', tour: 'visit', trip: 'visit', holiday: 'visit', travel: 'visit',
  leads: 'lead', clients: 'client', customers: 'client', customer: 'client', cases: 'case', files: 'case', file: 'case', appointments: 'appointment', appt: 'appointment',
  people: 'person', staff: 'team', employees: 'team', employee: 'team', agents: 'agent',
  owes: 'owe', owed: 'owe', owing: 'owe', owe: 'owe', pending: 'pending', outstanding: 'pending', balance: 'pending', balances: 'pending', dues: 'pending', due: 'due', overdue: 'overdue', late: 'overdue',
  profit: 'profit', kept: 'profit', earned: 'profit', earning: 'profit', income: 'received', received: 'received', collected: 'received', collection: 'collect', expenses: 'spent', expense: 'spent', spent: 'spent', spend: 'spent', spending: 'spent',
};

// Words that carry no meaning for matching.
const STOP = new Set(('a an the is are was were be been am do does did to of in on at for from by with and or but if so as it its this that these those i me you your we us our they them he she his her can could would should shall will may might please pls plz hi hello hey ' +
  'ka ki ke ko ne se hai hain tha thi hon ho hun hu mein me par pe aur to ye yeh wo woh is us bhi hi toh nahi nahin na ji jee kar kare karen karo karna kro karta karti raha rahi rahe gaya gayi gaye wala wali wale lye liye lie ke_ ap aap tum main mai hum mujh unhe unko unka unki iska iski isko uska uski sab sabhi koi kuch kuchh abhi bohat bahut zyada thoda ' +
  'about any some there here just also very really too before after still once even only then than  get got give tell show want need know like let ok okay yes no not what when where which who whom why how much many').split(/\s+/));
// …except these, which carry meaning in a question: keep them.
const KEEP = new Set(['what', 'how', 'when', 'where', 'who', 'why', 'which', 'howmuch', 'no', 'not']);
// Words that appear in nearly every question here and say nothing about the topic: they must not decide a match.
const FILLER = new Set(['say', 'said', 'again', 'client', 'other', 'thing', 'someone', 'something', 'anything', 'person']);

export function normalize(q: string): string {
  let s = (q || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'");
  s = s.replace(/[^a-z0-9#%'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  s = ` ${s} `;
  for (const [from, to] of PHRASES) s = s.split(` ${from} `).join(` ${to} `);
  return s.replace(/\s+/g, ' ').trim();
}

export function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  let out = w;
  for (const suf of ['ations', 'ation', 'ments', 'ment', 'ings', 'ing', 'ness', 'ies', 'ied', 'ed', 'es', 'ly', 's']) {
    if (out.endsWith(suf) && out.length - suf.length >= 3) {
      const base = out.slice(0, -suf.length);
      out = suf === 'ies' || suf === 'ied' ? base + 'y' : base;
      break;
    }
  }
  // "type"/"types"/"typed" and "handle"/"handles" must end up the same
  if (out.length > 3 && out.endsWith('e')) out = out.slice(0, -1);
  return out;
}

export function tokens(q: string): string[] {
  const out: string[] = [];
  for (const raw of normalize(q).split(' ')) {
    if (!raw) continue;
    const w = WORDS[raw] ?? raw;
    for (const part of w.split(' ')) {
      if (!part) continue;
      const st = stem(part);
      if ((STOP.has(part) || STOP.has(st)) && !KEEP.has(part) && !KEEP.has(st)) continue;
      out.push(st);
    }
  }
  return out;
}

// ---- BM25 over short documents ----
export interface Doc { id: string; text: string; boost?: number }
export class Index {
  private docs: { id: string; tf: Map<string, number>; len: number; boost: number }[] = [];
  private df = new Map<string, number>();
  private avg = 1;
  constructor(docs: Doc[]) {
    let total = 0;
    for (const d of docs) {
      const toks = tokens(d.text); const tf = new Map<string, number>();
      toks.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
      tf.forEach((_, t) => this.df.set(t, (this.df.get(t) || 0) + 1));
      this.docs.push({ id: d.id, tf, len: toks.length || 1, boost: d.boost ?? 1 });
      total += toks.length || 1;
    }
    this.avg = total / Math.max(1, docs.length);
  }
  // `cover` = how much of what was asked (weighted by how telling each word is) the document contains.
  // A word the knowledge has never seen counts against it, so "capital of France" does not match "Schengen".
  search(query: string, k = 3): { id: string; score: number; cover: number }[] {
    const qt = Array.from(new Set(tokens(query))).filter(t => !KEEP.has(t) && !FILLER.has(t));
    if (!qt.length) return [];
    const N = this.docs.length; const k1 = 1.4, b = 0.7;
    const idfOf = (t: string) => { const df = this.df.get(t) || 0; return Math.log(1 + (N - df + 0.5) / (df + 0.5)); };
    const all = qt.reduce((s, t) => s + idfOf(t), 0) || 1;
    const res = this.docs.map(d => {
      let score = 0, got = 0;
      for (const t of qt) {
        const f = d.tf.get(t); if (!f) continue;
        const idf = idfOf(t); got += idf;
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.len / this.avg))));
      }
      return { id: d.id, score: score * d.boost, cover: got / all };
    }).filter(r => r.score > 0).sort((a, b2) => b2.score - a.score);
    return res.slice(0, k);
  }
}
