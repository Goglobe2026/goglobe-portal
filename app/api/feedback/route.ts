import { NextRequest, NextResponse } from 'next/server';
import { readCollection, writeCollection } from '@/lib/store';
import { getCaseStatusData } from '@/lib/case-verify';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { caseReferenceCode, rating, wouldRecommend, moneyDemanded, moneyDemandedDetails, comment } = body;

  if (!caseReferenceCode || !rating) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Confirm this is a real case before accepting feedback for it — and pull
  // the consultant off the real record server-side, never trust a client-ID
  // the browser could have sent.
  const cases = readCollection('cases');
  const matchedCase = cases.find((c: any) => c.referenceCode === caseReferenceCode);
  if (!matchedCase) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const feedback = readCollection('clientfeedback');
  feedback.push({
    id: `cf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    caseReferenceCode,
    clientName: matchedCase.name,
    consultantId: matchedCase.consultant,
    rating: Math.max(1, Math.min(5, Number(rating) || 0)),
    wouldRecommend: !!wouldRecommend,
    moneyDemanded: !!moneyDemanded,
    moneyDemandedDetails: moneyDemandedDetails || '',
    comment: comment || '',
    submittedAt: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }),
    reviewedByCeo: false,
  });
  await writeCollection('clientfeedback', feedback);

  return NextResponse.json({ ok: true });
}
