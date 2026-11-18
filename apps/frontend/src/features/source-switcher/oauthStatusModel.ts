import type { BffSourceConfig } from '../../bff/sourcesApi';

type OAuthState = NonNullable<BffSourceConfig['oauth']>;

/** The sign-in state as a sentence: signed in (until when, with which scopes) or not. */
export function signInSummary(oauth: OAuthState, locale?: string): string {
  if (!oauth.signedIn) return 'Not signed in';
  const until = oauth.expiresAt ? new Date(oauth.expiresAt) : null;
  const expiry = until && !Number.isNaN(until.getTime()) ? `, access token expires ${until.toLocaleString(locale)}` : '';
  return `Signed in${expiry}`;
}
