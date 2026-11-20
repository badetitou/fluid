import { githubRepoListSchema, githubRepoSchema, type GithubRepo } from '@fluid/shared';
import { BffHttpError, request } from '../../../../bff/http';

// The BFF's GitHub source (`/api/github-repos`): analysed public repositories. Answers are
// validated with the shared zod schemas.

const PATH = '/api/github-repos';

export interface GithubReposApi {
  /** The analysed repositories, or `null` when the BFF has the GitHub source off or is unreachable. */
  list: (signal: AbortSignal) => Promise<GithubRepo[] | null>;
  /** Asks the BFF to download and analyse `owner/name`; rejects with a readable message. */
  add: (repo: string, signal: AbortSignal) => Promise<GithubRepo>;
}

/** `fetch` rejects with a TypeError when the server cannot be reached at all. */
const unreachable = (err: unknown) => err instanceof TypeError;

export const githubReposApi: GithubReposApi = {
  list: async (signal) => {
    try {
      return githubRepoListSchema.parse(await request<unknown>(PATH, { signal }));
    } catch (err) {
      if ((err instanceof BffHttpError && err.status === 404) || unreachable(err)) return null;
      throw err;
    }
  },
  add: async (repo, signal) => {
    try {
      const body = JSON.stringify({ repo });
      return githubRepoSchema.parse(await request<unknown>(PATH, { method: 'POST', body, signal }));
    } catch (err) {
      if (err instanceof BffHttpError) throw new Error(`The BFF could not add ${repo} (HTTP ${err.status}).`);
      if (unreachable(err)) throw new Error('The BFF cannot be reached.');
      throw err;
    }
  },
};
