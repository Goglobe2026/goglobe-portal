import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { askGuide } from '@/lib/coach';
import { coachProvider, coachModel, askAi, cleanContext, cleanHistory, rateLimited } from '@/lib/coachAi';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Is an AI assistant connected? (Only says yes or no — never the key.)
export async function GET(req: NextRequest) {
  const s = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  const p = coachProvider();
  return NextResponse.json({ ai: !!p, provider: p, model: p ? coachModel(p) : null }, { headers: NO_STORE });
}

// Ask the coach. { question, history?, context?, mode? }.
//  mode 'chat' (default): answer a sales question.
//  mode 'post': tidy up a social post draft (needs an AI key; otherwise the draft is returned as it is).
// Without an AI key — or if the AI service fails — the answer comes from the built-in guide.
export async function POST(req: NextRequest) {
  const s = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const question = String(body?.question ?? '').trim().slice(0, 1200);
  if (!question) return NextResponse.json({ error: 'Type your question first.' }, { status: 400 });
  const who = s.type === 'employee' ? s.staffId : 'admin';
  if (rateLimited(`coach:${who}`)) return NextResponse.json({ error: 'That is a lot of questions in a short time — please wait a few minutes.' }, { status: 429 });

  const context = cleanContext(body?.context);
  const history = cleanHistory(body?.history);
  const mode = body?.mode === 'post' ? 'post' : 'chat';

  if (mode === 'post') {
    if (!coachProvider()) return NextResponse.json({ source: 'guide', answer: question, note: 'No AI key is set up, so the post is unchanged.' }, { headers: NO_STORE });
    try {
      const lang = String(body?.lang || 'English').slice(0, 20), dest = String(body?.destination || '').slice(0, 40);
      const r = await askAi(`Improve this WhatsApp/social post for ${dest || 'our'} visa clients in ${lang}. Keep it under 130 words, friendly and honest, keep the contact line and hashtags, keep any [placeholders], never promise approval. Return only the post text.\n\n${question}`, [], context,
        'Return only the improved post, with no explanation.');
      return NextResponse.json({ source: 'ai', answer: r.text, provider: r.provider }, { headers: NO_STORE });
    } catch (e) {
      return NextResponse.json({ source: 'guide', answer: question, note: `The AI service could not be reached (${e instanceof Error ? e.message : 'error'}), so the post is unchanged.` }, { headers: NO_STORE });
    }
  }

  if (coachProvider()) {
    try {
      const r = await askAi(question, history, context);
      return NextResponse.json({ source: 'ai', answer: r.text, provider: r.provider }, { headers: NO_STORE });
    } catch (e) {
      const guide = askGuide(question, context?.destination);
      return NextResponse.json({ source: 'guide', guide, note: `The AI assistant could not be reached (${e instanceof Error ? e.message : 'error'}) — here is the built-in guide instead.` }, { headers: NO_STORE });
    }
  }
  return NextResponse.json({ source: 'guide', guide: askGuide(question, context?.destination) }, { headers: NO_STORE });
}
