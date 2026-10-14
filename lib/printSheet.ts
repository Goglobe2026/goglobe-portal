// Prints just the document (invoice, salary slip, closing report) — not the
// app around it. A clean copy is placed directly under <body> and everything
// else is hidden while the print dialog is open, so the page count is the
// document's own length instead of the screen behind it.
export function printSheet() {
  const src = document.getElementById('invoice-print-area');
  if (!src) { window.print(); return; }
  const clone = src.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  // Typed-in values live on the element, not in the markup — copy them across.
  const from = src.querySelectorAll('input, textarea, select');
  const to = clone.querySelectorAll('input, textarea, select');
  from.forEach((el, i) => {
    const t = to[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const v = (el as HTMLInputElement).value;
    if (el.tagName === 'TEXTAREA') t.textContent = v;
    else if (el.tagName === 'SELECT') Array.from((t as HTMLSelectElement).options).forEach(o => { o.selected = o.value === v; });
    else t.setAttribute('value', v);
  });
  const host = document.createElement('div');
  host.id = 'print-root';
  host.appendChild(clone);
  document.body.appendChild(host);
  document.body.classList.add('printing');
  const cleanup = () => {
    host.remove();
    document.body.classList.remove('printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
