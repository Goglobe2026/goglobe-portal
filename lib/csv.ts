// Turns any array of flat objects into a downloaded CSV file, entirely in
// the browser — no server round-trip, no data leaving the page except into
// the file the user saves themselves.
export function exportToCsv(filename: string, rows: Record<string, any>[]): boolean {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ];
  const csv = lines.join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

// Parses CSV text into headers + rows, correctly handling quoted fields
// that contain commas, quotes, or newlines — the same complexity a real
// Facebook Lead Ads export or Excel-saved-as-CSV file actually has.
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Strip a UTF-8 BOM if present (common from Excel exports)
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r') { /* skip, \n handles the line break */ }
      else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter(r => r.some(c => c.trim() !== ''));
  const [headers, ...dataRows] = nonEmpty;
  return { headers: headers || [], rows: dataRows };
}
