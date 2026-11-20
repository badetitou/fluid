import { githubRepoNameSchema, type GithubRepo, type GithubRepoStatus } from '@fluid/shared';
import type { SourceEntry } from '../../manifest';

// Pure logic of the built-in `github` source provider: what the user types → `owner/name`,
// and an analysed repository of the BFF → a source of the switcher.

const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+\/[^/?#]+?)(?:\.git)?\/?$/i;

/**
 * `owner/name` from what the user typed: `owner/name` or a repository URL
 * (`https://github.com/owner/name`, optionally ending in `.git` or `/`).
 * Throws a readable message otherwise.
 */
export function normaliseGithubRepo(input: string): string {
  const text = input.trim();
  const candidate = GITHUB_URL.exec(text)?.[1] ?? text.replace(/\.git$/i, '').replace(/\/$/, '');
  const parsed = githubRepoNameSchema.safeParse(candidate);
  if (!parsed.success) throw new Error('Expected owner/name or https://github.com/owner/name');
  return parsed.data;
}

/** Statuses of a repository that is not analysed yet: shown, refreshed, not pickable. */
const PENDING: ReadonlySet<GithubRepoStatus> = new Set(['queued', 'downloading', 'analyzing']);

const STATUS_TEXT: Record<GithubRepoStatus, string> = {
  queued: 'Queued for analysis',
  downloading: 'Downloading…',
  analyzing: 'Analysing with Model…',
  ready: 'Analysed with Model',
  failed: 'Analysis failed',
};

const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The text under a repository in the switcher: its status, and the error when it failed. */
export function repoDescription(repo: Pick<GithubRepo, 'status' | 'error'>): string {
  const status = STATUS_TEXT[repo.status];
  return clip(repo.status === 'failed' && repo.error ? `${status}: ${repo.error}` : status, DESCRIPTION_MAX);
}

/** The BFF's absolute base URL; an empty base means the page's own origin (nginx proxies /api). */
export function bffBaseUrl(base: string, origin: string): string {
  return (base || origin).replace(/\/$/, '');
}

/** A repository of the BFF as a source: `owner/name` (`@ref`), its proxied GraphQL URL, its status. */
export function githubRepoSource(repo: GithubRepo, bffBase: string): SourceEntry {
  const name = repo.ref ? `${repo.repo}@${repo.ref}` : repo.repo;
  return {
    name: clip(name, NAME_MAX),
    url: `${bffBase}${repo.graphqlPath}`,
    description: repoDescription(repo),
    ...(PENDING.has(repo.status) ? { pending: true } : {}),
  };
}
