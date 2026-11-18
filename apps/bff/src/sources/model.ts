import { z } from 'zod';

// Pure logic for source configs: request/response schemas and the outgoing auth header.

export const DEFAULT_HEADER = 'Authorization';

const httpUrl = z
  .string()
  .trim()
  .refine((v) => {
    try {
      return ['http:', 'https:'].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, 'url must be an absolute http(s) URL');

// RFC 9110 token characters only, so a header name can never carry CR/LF or separators.
const headerName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9-]+$/, 'invalid header name');
const secret = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[^\r\n\0]+$/, 'secret must be a single line');
const name = z.string().trim().min(1).max(200);

export const createSourceBody = z.object({
  name,
  url: httpUrl,
  authKind: z.enum(['none', 'header']).default('none'),
  headerName: headerName.optional(),
  secret: secret.optional(),
});
export type CreateSourceBody = z.infer<typeof createSourceBody>;

/** PUT semantics for the secret: omitted = keep, `null` = remove, string = replace. */
export const updateSourceBody = z
  .object({
    name,
    url: httpUrl,
    authKind: z.enum(['none', 'header']),
    headerName: headerName.nullish(),
    secret: secret.nullish(),
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

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  authKind: string;
  headerName: string | null;
  secret: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What the API returns: never the secret, only whether one is stored. */
export function toPublicSource(r: SourceRecord) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    authKind: r.authKind,
    headerName: r.headerName ?? (r.authKind === 'header' ? DEFAULT_HEADER : null),
    hasSecret: r.secret !== null,
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
