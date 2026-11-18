import { z } from 'zod';
import { request } from '../../bff/http';

// The BFF's saved source configs. The secret is only ever sent (create / update), never read back:
// the answers say whether one is stored (`hasSecret`).

export const bffSourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  authKind: z.enum(['none', 'header']),
  headerName: z.string().nullable(),
  hasSecret: z.boolean(),
});
export type BffSourceConfig = z.infer<typeof bffSourceConfigSchema>;

/** What is sent to create a config. */
export interface CreateBffSource {
  name: string;
  url: string;
  authKind: 'none' | 'header';
  headerName?: string;
  secret?: string;
}

/** What is sent to change a config; `secret`: omitted keeps it, `null` removes it, a string replaces it. */
export type UpdateBffSource = Partial<Omit<CreateBffSource, 'secret' | 'headerName'>> & {
  headerName?: string | null;
  secret?: string | null;
};

const path = (id: string) => `/api/sources/${encodeURIComponent(id)}`;

export const bffSourcesApi = {
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
};
