import type { BffSourceConfig, UpdateBffSource } from './api';

export const DEFAULT_AUTH_HEADER = 'Authorization';

/** What the user fills in: the secret is typed here only until it is sent. */
export interface AuthForm {
  authKind: 'none' | 'header';
  headerName: string;
  /** Empty = leave the stored secret as it is. */
  secret: string;
}

/** The form's starting point, from the stored config (never holds a secret). */
export const authFormOf = (config: Pick<BffSourceConfig, 'authKind' | 'headerName'> | null): AuthForm => ({
  authKind: config?.authKind ?? 'none',
  headerName: config?.headerName ?? DEFAULT_AUTH_HEADER,
  secret: '',
});

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
  if (form.authKind === 'none') return { authKind: 'none', headerName: null, secret: null };
  const secret = form.secret.trim();
  return {
    authKind: 'header',
    headerName: form.headerName.trim() || DEFAULT_AUTH_HEADER,
    ...(secret ? { secret } : {}),
  };
}
