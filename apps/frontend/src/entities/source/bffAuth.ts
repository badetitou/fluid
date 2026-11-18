import type { BffSourceConfig, UpdateBffSource } from '../../bff/sourcesApi';
import type { SourceAuth } from '../plugin';
import { oauthFormError, oauthFormOf, oauthPatch, type OAuthForm } from './oauthForm';

export const DEFAULT_AUTH_HEADER = 'Authorization';

/** What the user fills in: the secrets are typed here only until they are sent. */
export interface AuthForm {
  authKind: 'none' | 'header' | 'oauth';
  headerName: string;
  /** Empty = leave the stored secret as it is. */
  secret: string;
  oauth: OAuthForm;
}

/**
 * The form's starting point, from the stored config (never holds a secret). A source not
 * authenticated yet whose plugin ships OAuth settings starts on OAuth with those filled in.
 */
export const authFormOf = (config: BffSourceConfig | null, suggested?: SourceAuth): AuthForm => ({
  authKind: !config || config.authKind === 'none' ? (suggested ? 'oauth' : 'none') : config.authKind,
  headerName: config?.headerName ?? DEFAULT_AUTH_HEADER,
  secret: '',
  oauth: oauthFormOf(config, suggested),
});

/** Changes whenever the stored settings do, so the form starts over from them (not on a sign-in). */
export const authFormKey = (config: BffSourceConfig): string =>
  [
    config.id,
    config.authKind,
    config.headerName,
    config.hasSecret,
    config.oauth?.issuer,
    config.oauth?.clientId,
    config.oauth?.hasClientSecret,
  ].join(':');

/** Why the form cannot be saved yet, or `null`. */
export const authFormError = (form: AuthForm): string | null =>
  form.authKind === 'oauth' ? oauthFormError(form.oauth) : null;

/** A name the BFF accepts (non-empty) for a source the user did not name: its host, else the URL. */
export function bffSourceName(url: string, name?: string): string {
  const given = name?.trim();
  if (given) return given;
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/**
 * The body to send for the form: with `none` any stored secret is removed (`null`); with `header`
 * the header name is sent and the secret only when one was typed (else the stored one is kept).
 */
export function authPatch(form: AuthForm): UpdateBffSource {
  if (form.authKind === 'oauth') return { authKind: 'oauth', oauth: oauthPatch(form.oauth) };
  if (form.authKind === 'none') return { authKind: 'none', headerName: null, secret: null };
  const secret = form.secret.trim();
  return {
    authKind: 'header',
    headerName: form.headerName.trim() || DEFAULT_AUTH_HEADER,
    ...(secret ? { secret } : {}),
  };
}
