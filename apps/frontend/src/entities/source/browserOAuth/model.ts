import { z } from 'zod';
import type { SourceAuth } from '../../plugin';

// Pure logic of the browser-only OAuth fallback (no BFF): the page is a public client, the
// tokens live in memory only. RFC 10017 ranks this pattern least safe: plugins run in the page.

const isHttpUrl = (v: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};
/** An issuer identifier carries no query or fragment (RFC 8414). */
const isIssuer = (v: string) => isHttpUrl(v) && !v.includes('?') && !v.includes('#');

/** What the browser keeps per source (no secret: a public client has none). */
export const browserOAuthSettingsSchema = z.object({
  issuer: z.string().max(2000).refine(isIssuer),
  clientId: z.string().min(1).max(500),
  scopes: z.array(z.string().min(1).max(200)).max(50),
  resource: z.string().max(2000).refine(isHttpUrl).optional(),
});
export type BrowserOAuthSettings = z.infer<typeof browserOAuthSettingsSchema>;

/** The settings read back from `localStorage`, checked: anything malformed is dropped. */
export function parseBrowserOAuthSettings(saved: unknown): Record<string, BrowserOAuthSettings> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(saved);
  if (!parsed.success) return {};
  const out: Record<string, BrowserOAuthSettings> = {};
  for (const [url, value] of Object.entries(parsed.data)) {
    const settings = browserOAuthSettingsSchema.safeParse(value);
    if (settings.success) out[url] = settings.data;
  }
  return out;
}

/** The key of a direct source in the "sign in again" store (BFF sources use their config id). */
export const browserAuthKey = (sourceUrl: string): string => `browser:${sourceUrl}`;

/** What a token was obtained with: other settings mean another sign-in. */
export const settingsFingerprint = (s: BrowserOAuthSettings): string =>
  JSON.stringify([s.issuer, s.clientId, [...s.scopes].sort(), s.resource ?? '']);

export const CALLBACK_FILE = 'oauth-callback.html';
export const CALLBACK_MESSAGE_TYPE = 'fluid-oauth-browser';

/** The redirect URI to register with the authorization server: a static page next to the app. */
export const browserRedirectUri = (pageOrigin: string, baseUrl: string): string =>
  new URL(`${baseUrl.replace(/\/?$/, '/')}${CALLBACK_FILE}`, pageOrigin).href;

const callbackMessageSchema = z.object({ type: z.literal(CALLBACK_MESSAGE_TYPE), url: z.string().max(8000) });

/**
 * The callback URL a message from the callback page carries: only from the page's own origin, only
 * the expected shape, only the redirect URI itself. Anything else is ignored (`null`).
 */
export function readCallbackMessage(event: { origin: string; data: unknown }, pageOrigin: string, redirectUri: string): URL | null {
  if (event.origin !== pageOrigin) return null;
  const parsed = callbackMessageSchema.safeParse(event.data);
  if (!parsed.success) return null;
  try {
    const url = new URL(parsed.data.url);
    const expected = new URL(redirectUri);
    return url.origin === expected.origin && url.pathname === expected.pathname ? url : null;
  } catch {
    return null;
  }
}

/** An access token held in memory; a refresh token, if the server sends one, is not kept. */
export interface MemoryToken {
  accessToken: string;
  /** Epoch ms, or `null` when the server did not say. */
  expiresAt: number | null;
  scope: string | null;
  fingerprint: string;
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().refine((t) => t.toLowerCase() === 'bearer'),
  expires_in: z.number().positive().optional(),
  scope: z.string().optional(),
});

/** Validates the token endpoint answer and keeps only what the page needs. */
export function toMemoryToken(response: unknown, now: number, fingerprint: string, requested: string[]): MemoryToken {
  const t = tokenResponseSchema.parse(response);
  return {
    accessToken: t.access_token,
    expiresAt: t.expires_in ? now + t.expires_in * 1000 : null,
    scope: t.scope ?? (requested.join(' ') || null),
    fingerprint,
  };
}

/** Whether the token still applies to these settings and has not expired (with a small margin). */
export const tokenUsable = (token: MemoryToken | undefined, settings: BrowserOAuthSettings, now: number, skewMs = 10_000) =>
  !!token && token.fingerprint === settingsFingerprint(settings) && (token.expiresAt === null || token.expiresAt - skewMs > now);

/** The form of the settings, as typed. */
export interface BrowserOAuthForm {
  issuer: string;
  clientId: string;
  /** Space-separated. */
  scopes: string;
  resource: string;
}

/** The form's starting point: the kept settings, else those the source's plugin ships, else empty. */
export function browserFormOf(settings?: BrowserOAuthSettings, suggested?: SourceAuth): BrowserOAuthForm {
  const from = settings ?? suggested;
  return {
    issuer: from?.issuer ?? '',
    clientId: from?.clientId ?? '',
    scopes: (from?.scopes ?? []).join(' '),
    resource: from?.resource ?? '',
  };
}

/** The settings the form describes, or why it cannot be saved. */
export function browserSettingsOf(form: BrowserOAuthForm): BrowserOAuthSettings | { error: string } {
  const candidate = {
    issuer: form.issuer.trim(),
    clientId: form.clientId.trim(),
    scopes: [...new Set(form.scopes.split(/\s+/).filter(Boolean))],
    ...(form.resource.trim() ? { resource: form.resource.trim() } : {}),
  };
  if (!candidate.issuer) return { error: 'The issuer is required.' };
  if (!candidate.clientId) return { error: 'The client id is required.' };
  const parsed = browserOAuthSettingsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : { error: 'The issuer and resource must be http(s) URLs without query or fragment.' };
}

/** The sign-in state as a sentence. */
export function browserTokenSummary(token: MemoryToken | undefined, usable: boolean, locale?: string): string {
  if (!token) return 'Not signed in';
  if (!usable) return 'Sign-in expired';
  const until = token.expiresAt ? `, access token expires ${new Date(token.expiresAt).toLocaleString(locale)}` : '';
  return `Signed in in this tab${until}`;
}
