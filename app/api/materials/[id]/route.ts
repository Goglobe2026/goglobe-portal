import { NextRequest, NextResponse } from 'next/server';
import { readCollection } from '@/lib/store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const materials = readCollection('marketingmaterials');
  const material = materials.find(m => m.id === id);
  if (!material || !material.pdf) {
    return new NextResponse('Not found', { status: 404 });
  }

  // material.pdf is a data URI like "data:application/pdf;base64,JVBERi0x..."
  const base64 = material.pdf.split(',')[1] || '';
  const bytes = Buffer.from(base64, 'base64');

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${material.pdfName || 'document.pdf'}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
