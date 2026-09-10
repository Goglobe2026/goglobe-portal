// A simple in-memory brute-force guard. Not shared across multiple server
// instances (this app only runs as one), and resets if the server restarts
// — an acceptable trade-off for a small business's login, not a bank vault.
// Purpose: stop someone from just trying every 4-digit PIN in a row.

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

type Entry = { count: number; lockedUntil: number | null };
const attempts = new Map<string, Entry>();

export function isLockedOut(key: string): number | null {
  const entry = attempts.get(key);
  if (!entry || !entry.lockedUntil) return null;
  if (Date.now() >= entry.lockedUntil) {
    attempts.delete(key);
    return null;
  }
  return Math.ceil((entry.lockedUntil - Date.now()) / 60000); // minutes remaining
}

export function recordFailedAttempt(key: string): void {
  const entry = attempts.get(key) || { count: 0, lockedUntil: null };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  attempts.set(key, entry);
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
