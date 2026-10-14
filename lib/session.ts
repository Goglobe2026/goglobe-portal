import crypto from 'crypto';
import type { Session } from './types';

// This secret never reaches the browser — it only signs cookies on the server.
// Set SESSION_SECRET in your hosting provider's environment variables.
const SECRET = process.env.SESSION_SECRET || 'dev-only-secret-change-in-production';

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function createSessionToken(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  // Constant-time comparison to avoid timing attacks on the signature check.
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'goglobe_session';
