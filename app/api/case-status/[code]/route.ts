import { NextRequest, NextResponse } from 'next/server';
import { getCaseStatusData } from '@/lib/case-verify';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = getCaseStatusData(code);
  if (!data) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ found: true, ...data });
}
