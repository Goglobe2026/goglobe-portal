import type { CSSProperties } from 'react';
export const ARIAL = 'Arial, Helvetica, sans-serif';
export const NAVY = '#14213D';
export const th: CSSProperties = { background: NAVY, color: '#fff', padding: '11px 13px', fontSize: 14, fontWeight: 700, textAlign: 'left', fontFamily: ARIAL };
export const td: CSSProperties = { padding: '11px 13px', fontSize: 15, borderBottom: '1px solid #e3e8ea', fontFamily: ARIAL, verticalAlign: 'middle' };
export const R: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' };
export const inputStyle: CSSProperties = { fontSize: 15, padding: '8px 10px', border: '1px solid #b8c4c0', borderRadius: 8, fontFamily: ARIAL, width: '100%' };
export const lbl: CSSProperties = { fontSize: 13.5, fontWeight: 700, color: '#3A4A68', margin: '10px 0 4px', display: 'block' };
export const bigBtn: CSSProperties = { fontSize: 15, padding: '10px 18px' };
export function waLink(phone: string, text: string) {
  let d = (phone || '').replace(/[^0-9]/g, '');
  if (d.startsWith('0')) d = '92' + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
