import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Login CSRF protection: the browser that starts a sign-in holds a random binder in an HttpOnly
// cookie; the server keeps only its hash with the pending state. A callback that arrives
// without the matching cookie (a forged link) is refused.

export const BINDER_COOKIE = 'fluid_oauth';
const COOKIE_PATH = '/api/oauth';
const MAX_AGE_SECONDS = 600;

export const newBinder = () => randomBytes(32).toString('base64url');
export const hashBinder = (binder: string) => createHash('sha256').update(binder).digest('hex');

export function binderMatches(expectedHash: string, binder: string | null): boolean {
  if (!binder) return false;
  const a = Buffer.from(hashBinder(binder));
  const b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** One cookie per sign-in (named after its state), so concurrent sign-ins do not collide. */
export const binderCookieName = (state: string) =>
  `${BINDER_COOKIE}_${createHash('sha256').update(state).digest('hex').slice(0, 16)}`;

export const setBinderCookie = (state: string, binder: string, secure: boolean) =>
  `${binderCookieName(state)}=${binder}; Path=${COOKIE_PATH}; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
export const clearBinderCookie = (state: string, secure: boolean) =>
  `${binderCookieName(state)}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

export function readBinder(cookieHeader: string | undefined, state: string | null): string | null {
  if (!state) return null;
  const wanted = binderCookieName(state);
  for (const part of (cookieHeader ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === wanted && value.length) return value.join('=') || null;
  }
  return null;
}
