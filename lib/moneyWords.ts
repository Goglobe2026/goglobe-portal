const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')); }
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(' ');
}

// 146720 -> "Rupees One Hundred Forty-Six Thousand Seven Hundred Twenty Only"
export function rupeesInWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return 'Rupees Zero Only';
  const units: [number, string][] = [[1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1_000, 'Thousand']];
  const out: string[] = [];
  for (const [size, name] of units) {
    if (n >= size) { out.push(below1000(Math.floor(n / size)) + ' ' + name); n %= size; }
  }
  if (n > 0) out.push(below1000(n));
  return 'Rupees ' + out.join(' ') + ' Only';
}
