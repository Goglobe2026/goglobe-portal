// The arithmetic behind payment plans, kept free of any other import so both
// the money helpers and the plan helpers can use it.
//
// Rule: money received on a file settles the OLDEST unpaid part first.
// A payment larger than the part in front of it carries on into the next part.

export interface PartShare { paid: number; remaining: number }

export function allocateParts(amounts: number[], paid: number): { shares: PartShare[]; leftover: number } {
  let pool = Math.max(0, paid);
  const shares = amounts.map(a => {
    const amt = Math.max(0, a);
    const take = Math.min(amt, pool);
    pool -= take;
    return { paid: take, remaining: amt - take };
  });
  return { shares, leftover: pool };
}

// Which parts did a payment touch? `before` and `after` are the totals
// received on the file before and after it. Returns part indexes.
export function partsTouched(amounts: number[], before: number, after: number): number[] {
  const out: number[] = [];
  let start = 0;
  amounts.forEach((a, i) => {
    const end = start + Math.max(0, a);
    if (after > start && before < end) out.push(i);
    start = end;
  });
  return out;
}
