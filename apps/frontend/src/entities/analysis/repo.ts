import { githubRefSchema, githubRepoNameSchema } from '@fluid/shared';

// Pure logic of the in-browser analysis: which repository a URL names, the virtual GraphQL URL its
// engine answers on, and where the tarball comes from. See docs/guides/browser-analysis.md.

export interface AnalysisRepo {
  /** `owner/name`. */
  repo: string;
  /** Branch, tag or commit; the default branch when absent. */
  ref?: string;
}

/** Scheme of the virtual GraphQL URL served by an engine running in the page. */
export const ANALYSIS_SCHEME = 'model-wasm://';

/** The repository of `/analyse/:owner/:name` (and an optional `?ref=`); throws a readable message. */
export function parseAnalysisRepo(owner: string | undefined, name: string | undefined, ref?: string | null): AnalysisRepo {
  const repo = githubRepoNameSchema.safeParse(`${owner ?? ''}/${(name ?? '').replace(/\.git$/i, '')}`);
  if (!repo.success) throw new Error('Expected /analyse/owner/name');
  if (!ref) return { repo: repo.data };
  if (!githubRefSchema.safeParse(ref).success) throw new Error('Invalid ref');
  return { repo: repo.data, ref };
}

/** The virtual GraphQL URL of a repository: `model-wasm://owner/name` (`@ref`). */
export const analysisUrl = ({ repo, ref }: AnalysisRepo): string =>
  `${ANALYSIS_SCHEME}${repo}${ref ? `@${ref}` : ''}`;

export const isAnalysisUrl = (url: string): boolean => url.startsWith(ANALYSIS_SCHEME);

/** The repository behind a virtual URL, or `null` for any other URL. */
export function parseAnalysisUrl(url: string): AnalysisRepo | null {
  if (!isAnalysisUrl(url)) return null;
  const [repo, ...ref] = url.slice(ANALYSIS_SCHEME.length).split('@');
  return githubRepoNameSchema.safeParse(repo).success ? { repo, ...(ref.length ? { ref: ref.join('@') } : {}) } : null;
}

/** The shareable page of a repository: `/analyse/owner/name` (`?ref=`). */
export const analysisPath = ({ repo, ref }: AnalysisRepo): string =>
  `/analyse/${repo}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** GitHub's tree listing of a repository: CORS-enabled, one call (the tarball host is not CORS-enabled). */
export const treeUrl = ({ repo, ref }: AnalysisRepo): string =>
  `https://api.github.com/repos/${repo}/git/trees/${encodePath(ref ?? 'HEAD')}?recursive=1`;

/** One file of a repository, from the CORS-enabled raw host. */
export const rawUrl = ({ repo, ref }: AnalysisRepo, path: string): string =>
  `https://raw.githubusercontent.com/${repo}/${encodePath(ref ?? 'HEAD')}/${encodePath(path)}`;
