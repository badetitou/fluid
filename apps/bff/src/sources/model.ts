import { z } from 'zod';
import { httpUrl } from './url';
import { oauthFields, toPublicOAuth, type CredentialRecord, type OAuthRecordFields } from './oauth/model';

// Pure logic for source configs: request/response schemas and the outgoing auth header.

export const DEFAULT_HEADER = 'Authorization';

// Protocol and hop-by-hop headers the proxy controls itself (or that fetch forbids).
const RESERVED_HEADERS = new Set([
  'content-type',
  'content-length',
  'host',
  'accept',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'expect',
  'cookie',
]);
export const isReservedHeader = (name: string) =>
  RESERVED_HEADERS.has(name.toLowerCase()) || name.toLowerCase().startsWith('proxy-');

// RFC 9110 token characters only, so a header name can never carry CR/LF or separators.
const headerName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9-]+$/, 'invalid header name')
  .refine((v) => !isReservedHeader(v), 'this header name is reserved');
const secret = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[^\r\n\0]+$/, 'secret must be a single line');
const name = z.string().trim().min(1).max(200);

const AUTH_KINDS = ['none', 'header', 'oauth'] as const;

export const createSourceBody = z
  .object({
    name,
    url: httpUrl,
    authKind: z.enum(AUTH_KINDS).default('none'),
    headerName: headerName.optional(),
    secret: secret.optional(),
    oauth: z
      .object({
        issuer: oauthFields.issuer,
        clientId: oauthFields.clientId,
        clientSecret: oauthFields.clientSecret.optional(),
        scopes: oauthFields.scopes.default([]),
        resource: oauthFields.resource.optional(),
      })
      .optional(),
  })
  .refine((v) => v.authKind !== 'oauth' || v.oauth !== undefined, {
    path: ['oauth'],
    message: 'oauth settings (issuer, clientId) are required for authKind "oauth"',
  });
export type CreateSourceBody = z.infer<typeof createSourceBody>;

/** PUT semantics for the secret: omitted = keep, `null` = remove, string = replace. */
export const updateSourceBody = z
  .object({
    name,
    url: httpUrl,
    authKind: z.enum(AUTH_KINDS),
    headerName: headerName.nullish(),
    secret: secret.nullish(),
    /** Fields left out keep their value; `clientSecret` / `resource` accept null to clear. */
    oauth: z
      .object({
        issuer: oauthFields.issuer,
        clientId: oauthFields.clientId,
        clientSecret: oauthFields.clientSecret.nullable(),
        scopes: oauthFields.scopes,
        resource: oauthFields.resource.nullable(),
      })
      .partial(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
export type UpdateSourceBody = z.infer<typeof updateSourceBody>;

export const graphqlBody = z.object({
  query: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).nullish(),
  operationName: z.string().nullish(),
});
export type GraphqlBody = z.infer<typeof graphqlBody>;

/** GraphQL-over-HTTP response envelope; unknown keys (extensions...) are kept. */
export const upstreamEnvelope = z.looseObject({
  data: z.unknown().optional(),
  errors: z.array(z.looseObject({ message: z.string() })).optional(),
});
export type UpstreamEnvelope = z.infer<typeof upstreamEnvelope>;

export interface SourceRecord extends OAuthRecordFields {
  id: string;
  name: string;
  url: string;
  authKind: string;
  headerName: string | null;
  secret: string | null;
  authGeneration: number;
  createdAt: Date;
  updatedAt: Date;
}

/** What the API returns: never the secret, only whether one is stored. */
export function toPublicSource(r: SourceRecord, credential: CredentialRecord | null = null) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    authKind: r.authKind,
    headerName: r.headerName ?? (r.authKind === 'header' ? DEFAULT_HEADER : null),
    hasSecret: r.secret !== null,
    oauth: r.authKind === 'oauth' ? toPublicOAuth(r, credential) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
export type PublicSource = ReturnType<typeof toPublicSource>;

/** `Authorization` carries `Bearer <secret>`; any other header carries the secret as is. */
export function authHeaders(
  source: Pick<SourceRecord, 'authKind' | 'headerName'>,
  secretValue: string | null,
): Record<string, string> {
  if (source.authKind !== 'header' || !secretValue) return {};
  const header = source.headerName ?? DEFAULT_HEADER;
  return { [header]: header.toLowerCase() === 'authorization' ? `Bearer ${secretValue}` : secretValue };
}
