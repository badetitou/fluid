import type { BffSourceConfig, OAuthDiscovery, UpdateBffSource } from '../../bff/sourcesApi';
import type { SourceAuth } from '../plugin';

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

/** The form's starting point: the stored settings, else what the source's plugin suggests, else empty. */
export function oauthFormOf(config: BffSourceConfig | null, suggested?: SourceAuth): OAuthForm {
  const stored = config?.authKind === 'oauth' ? config.oauth : null;
  const from = stored ?? suggested;
  return {
    issuer: from?.issuer ?? '',
    clientId: from?.clientId ?? '',
    clientSecret: '',
    scopes: (from?.scopes ?? []).join(' '),
    resource: from?.resource ?? '',
  };
}

/** Fills issuer, scopes and resource from the source's discovery; what it did not find is left as typed. */
export function applyDiscovery(form: OAuthForm, discovery: OAuthDiscovery): OAuthForm {
  const { issuer, scopes, resource } = discovery.suggestion;
  return {
    ...form,
    issuer: issuer ?? form.issuer,
    scopes: scopes.length ? scopes.join(' ') : form.scopes,
    resource: resource ?? form.resource,
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
