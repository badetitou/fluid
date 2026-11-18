import { z } from 'zod';

// Pure logic of the OAuth sign-in: the popup's URL and message, and the GraphQL error that asks to reconnect.

/** The code the BFF puts in `extensions.code` of a source's answer when the user has to (re)sign in. */
export const AUTH_REQUIRED_CODE = 'FLUID_AUTH_REQUIRED';

export type AuthRequiredReason = 'signin' | 'expired' | 'insufficient_scope';

export interface AuthRequired {
  reason: AuthRequiredReason;
  /** The scope the source asked for, for `insufficient_scope`. */
  scope?: string;
}

const extensionsSchema = z.object({
  code: z.literal(AUTH_REQUIRED_CODE),
  reason: z.enum(['signin', 'expired', 'insufficient_scope']).catch('signin'),
  scope: z.string().optional().catch(undefined),
});

/** The first "authentication required" error of a GraphQL result, if any (the extensions are checked, not trusted). */
export function authRequiredOf(errors: readonly { extensions?: unknown }[] | undefined): AuthRequired | null {
  for (const error of errors ?? []) {
    const parsed = extensionsSchema.safeParse(error.extensions);
    if (parsed.success) return { reason: parsed.data.reason, ...(parsed.data.scope ? { scope: parsed.data.scope } : {}) };
  }
  return null;
}

/** What the BFF's callback page posts to the window that opened the popup. */
export const oauthMessageSchema = z.object({
  type: z.literal('fluid-oauth'),
  sourceId: z.string().nullable(),
  ok: z.boolean(),
});

/** The origin the BFF is served from; `bffBase` '' means the page's own origin. `null` if the base is not a URL. */
export function bffOrigin(bffBase: string, pageOrigin: string): string | null {
  if (!bffBase) return pageOrigin;
  try {
    return new URL(bffBase).origin;
  } catch {
    return null;
  }
}

/** The BFF URL the popup opens: it redirects to the authorization server; `scope` asks for more scopes. */
export function oauthStartUrl(bffBase: string, sourceId: string, pageOrigin: string, scope?: string): string {
  const params = new URLSearchParams({ origin: pageOrigin });
  if (scope) params.set('scope', scope);
  return `${bffBase.replace(/\/$/, '')}/api/sources/${encodeURIComponent(sourceId)}/oauth/start?${params}`;
}

/**
 * The result of the sign-in announced by a `message` event: only from the BFF's origin, only the
 * expected shape, only for this source. Anything else (other windows, other sources) is ignored.
 */
export function readOAuthMessage(
  event: { origin: string; data: unknown },
  expectedOrigin: string | null,
  sourceId: string,
): { ok: boolean } | null {
  if (expectedOrigin === null || event.origin !== expectedOrigin) return null;
  const parsed = oauthMessageSchema.safeParse(event.data);
  if (!parsed.success || parsed.data.sourceId !== sourceId) return null;
  return { ok: parsed.data.ok };
}

export type SignInStatus = 'idle' | 'waiting' | 'blocked' | 'closed' | 'failed';

/** What to tell the user about a sign-in that did not (yet) end well; `null` when there is nothing to say. */
export function signInHint(status: SignInStatus): string | null {
  switch (status) {
    case 'waiting':
      return 'Finish signing in in the window that opened…';
    case 'blocked':
      return 'The browser blocked the sign-in window: allow pop-ups for this site and try again.';
    case 'closed':
      return 'The sign-in window was closed before it finished.';
    case 'failed':
      return 'The sign-in failed: check the issuer, client id and secret, then try again.';
    default:
      return null;
  }
}
