'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#14213D', light: '#FFFFFF' } })
      .then(url => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size, background: 'var(--line)', borderRadius: 8 }} />;
  }
  return (
    <a href={dataUrl} download="verification-qr.png">
      <img src={dataUrl} alt="Verification QR code" width={size} height={size} style={{ borderRadius: 8, border: '1px solid var(--line)' }} />
    </a>
  );
}
