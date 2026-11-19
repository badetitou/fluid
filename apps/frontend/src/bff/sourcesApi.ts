import { z } from 'zod';
import { request } from './http';

// The BFF's saved source configs. The secret is only ever sent (create / update), never read back:
// the answers say whether one is stored (`hasSecret`).

export const bffSourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  authKind: z.enum(['none', 'header', 'oauth']),
  headerName: z.string().nullable(),
  hasSecret: z.boolean(),
  /** View actions may run on it from the BFF (MCP hosts): the "Allow changes" setting. */
  allowWrites: z.boolean().optional(),
  /** OAuth settings and sign-in state (never the client secret nor a token); only for `authKind: 'oauth'`. */
  oauth: z
    .object({
      issuer: z.string().nullable(),
      clientId: z.string().nullable(),
      hasClientSecret: z.boolean(),
      scopes: z.array(z.string()),
      resource: z.string().nullable(),
      signedIn: z.boolean(),
      expiresAt: z.string().nullable(),
      grantedScopes: z.array(z.string()),
    })
    .nullish(),
});
export type BffSourceConfig = z.infer<typeof bffSourceConfigSchema>;

/** What the BFF's discovery suggests for a source: only the part the settings form fills in. */
export const oauthDiscoverySchema = z.object({
  suggestion: z.object({
    issuer: z.string().nullable(),
    scopes: z.array(z.string()),
    resource: z.string().nullable(),
  }),
  authorizationServer: z.object({ supportsS256: z.boolean() }).nullable(),
});
export type OAuthDiscovery = z.infer<typeof oauthDiscoverySchema>;

/** The OAuth fields of a config; `clientSecret` is write-only. */
export interface OAuthSettingsBody {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  resource?: string;
}

/** What is sent to create a config. */
export interface CreateBffSource {
  name: string;
  url: string;
  authKind: 'none' | 'header' | 'oauth';
  allowWrites?: boolean;
  headerName?: string;
  secret?: string;
  oauth?: OAuthSettingsBody;
}

/** What is sent to change a config; `secret`: omitted keeps it, `null` removes it, a string replaces it. */
export type UpdateBffSource = Partial<Omit<CreateBffSource, 'secret' | 'headerName' | 'oauth'>> & {
  headerName?: string | null;
  secret?: string | null;
  /** Fields left out keep their value; `clientSecret` and `resource` accept `null` to clear. */
  oauth?: Partial<Omit<OAuthSettingsBody, 'clientSecret' | 'resource'>> & {
    clientSecret?: string | null;
    resource?: string | null;
  };
};

const path = (id: string) => `/api/sources/${encodeURIComponent(id)}`;

export const sourcesApi = {
  /** Resolves when the BFF answers; rejects when it is absent or unreachable. */
  ping: async (): Promise<void> => {
    await request<unknown>('/api/sources');
  },
  get: async (id: string): Promise<BffSourceConfig> =>
    bffSourceConfigSchema.parse(await request<unknown>(path(id))),
  create: async (body: CreateBffSource): Promise<BffSourceConfig> =>
    bffSourceConfigSchema.parse(await request<unknown>('/api/sources', { method: 'POST', body: JSON.stringify(body) })),
  update: async (id: string, body: UpdateBffSource): Promise<BffSourceConfig> =>
    bffSourceConfigSchema.parse(await request<unknown>(path(id), { method: 'PUT', body: JSON.stringify(body) })),
  remove: (id: string): Promise<void> => request<void>(path(id), { method: 'DELETE' }),
  /** Suggested issuer, scopes and resource for a source (its URL) and/or an issuer. */
  discover: async (query: { url?: string; issuer?: string }): Promise<OAuthDiscovery> => {
    const params = new URLSearchParams();
    if (query.url) params.set('url', query.url);
    if (query.issuer) params.set('issuer', query.issuer);
    return oauthDiscoverySchema.parse(await request<unknown>(`/api/oauth/discover?${params}`));
  },
  /** Forgets the stored sign-in of a source. */
  signOut: (id: string): Promise<void> => request<void>(`${path(id)}/oauth/credential`, { method: 'DELETE' }),
};
