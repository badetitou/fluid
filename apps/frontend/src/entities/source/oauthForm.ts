import type { BffSourceConfig, OAuthDiscovery, UpdateBffSource } from '../../bff/sourcesApi';

/** The OAuth part of the source settings form; the client secret is typed here only until it is sent. */
export interface OAuthForm {
  issuer: string;
  clientId: string;
  /** Empty = leave the stored secret as it is. */
  clientSecret: string;
  /** Space-separated. */
  scopes: string;
  resource: string;
}

export const splitScopes = (scopes: string): string[] => scopes.split(/\s+/).filter(Boolean);

/** The form's starting point: the stored OAuth settings, else empty. */
export function oauthFormOf(config: BffSourceConfig | null): OAuthForm {
  const stored = config?.authKind === 'oauth' ? config.oauth : null;
  return {
    issuer: stored?.issuer ?? '',
    clientId: stored?.clientId ?? '',
    clientSecret: '',
    scopes: (stored?.scopes ?? []).join(' '),
    resource: stored?.resource ?? '',
  };
}

/**
 * The fields the source's discovery found (issuer, scopes, resource), to merge into the form as it is
 * when the answer comes: what it did not find, and every other field, is left alone.
 */
export function discoveryPatch(discovery: OAuthDiscovery): Partial<OAuthForm> {
  const { issuer, scopes, resource } = discovery.suggestion;
  return {
    ...(issuer ? { issuer } : {}),
    ...(scopes.length ? { scopes: scopes.join(' ') } : {}),
    ...(resource ? { resource } : {}),
  };
}

/** Why the form cannot be saved yet, or `null`. */
export function oauthFormError(form: OAuthForm): string | null {
  if (!form.issuer.trim()) return 'The issuer is required.';
  if (!form.clientId.trim()) return 'The client id is required.';
  return null;
}

/** The OAuth fields to send: the secret only when one was typed, an emptied resource clears it. */
export function oauthPatch(form: OAuthForm): NonNullable<UpdateBffSource['oauth']> {
  const secret = form.clientSecret.trim();
  return {
    issuer: form.issuer.trim(),
    clientId: form.clientId.trim(),
    scopes: splitScopes(form.scopes),
    resource: form.resource.trim() || null,
    ...(secret ? { clientSecret: secret } : {}),
  };
}
