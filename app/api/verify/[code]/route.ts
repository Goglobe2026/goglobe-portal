import { NextRequest, NextResponse } from 'next/server';
import { getVerificationData } from '@/lib/verify';

// Public on purpose — anyone with a reference code or QR scan can check a
// booking is real. The shared helper already strips anything sensitive
// (no phone, passport number, CNIC, or address) before it gets here.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = getVerificationData(code);
  if (!data) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({ found: true, ...data });
}
