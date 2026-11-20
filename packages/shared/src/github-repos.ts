import { z } from 'zod';

// Contract of the GitHub source (epic: analyse a public GitHub repository with badetitou/Model and
// serve its model over GraphQL). Shared by the BFF routes (`/api/github-repos`) and the frontend
// `github` source provider plugin.

/** `owner/name` as GitHub allows it. */
export const githubRepoNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/, 'Expected owner/name')
  .refine((s) => !s.endsWith('/.') && !s.endsWith('/..'), 'Expected owner/name');

/** A branch, tag or commit; HEAD (the default branch) when absent. */
export const githubRefSchema = z.string().regex(/^[A-Za-z0-9._/-]{1,200}$/).refine((s) => !s.includes('..'));

export const addGithubRepoBody = z.object({
  repo: githubRepoNameSchema,
  ref: githubRefSchema.optional(),
});
export type AddGithubRepoBody = z.infer<typeof addGithubRepoBody>;

export const githubRepoStatusSchema = z.enum(['queued', 'downloading', 'analyzing', 'ready', 'failed']);
export type GithubRepoStatus = z.infer<typeof githubRepoStatusSchema>;

export const githubRepoSchema = z.object({
  /** Deterministic: lower-cased `owner--name` (plus `--ref` when a ref is given). */
  id: z.string().regex(/^[a-z0-9._-]+$/),
  repo: githubRepoNameSchema,
  ref: githubRefSchema.optional(),
  status: githubRepoStatusSchema,
  /** Set when status is `failed`; never contains a secret or a server path. */
  error: z.string().optional(),
  /** ISO date of the last status change. */
  updatedAt: z.string(),
  /** BFF path of the GraphQL endpoint, relative to the BFF base URL: `/api/github-repos/<id>/graphql`. */
  graphqlPath: z.string(),
});
export type GithubRepo = z.infer<typeof githubRepoSchema>;

export const githubRepoListSchema = z.array(githubRepoSchema);

/** Lower-cased deterministic id of a repository (and ref). */
export function githubRepoId(repo: string, ref?: string): string {
  const base = repo.toLowerCase().replace('/', '--');
  return ref ? `${base}--${ref.toLowerCase().replace(/[^a-z0-9._-]/g, '-')}` : base;
}
