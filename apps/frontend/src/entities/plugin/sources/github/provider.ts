import { BFF_URL } from '../../../../runtime-config';
import { SourceProviderUnavailable, type SourceProvider } from '../../sourceProvider';
import { BffUnreachable, githubReposApi, type GithubReposApi } from './githubReposApi';
import { bffBaseUrl, githubRepoSource, normaliseGithubRepo } from './model';

/** How often pending repositories are listed again while they are being analysed. */
export const GITHUB_POLL_MS = 3000;

const pageOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin);

/**
 * The built-in `github` provider: the public repositories the BFF analysed with Model, each
 * served over GraphQL by the BFF, and a form to analyse another one. Hidden when the BFF has
 * the GitHub source off (404), or does not answer before the provider was ever listed; once shown,
 * an unreachable BFF is an ordinary error, so the group stays and keeps polling.
 */
export function githubSourceProvider(api: GithubReposApi = githubReposApi, base = BFF_URL): SourceProvider {
  let shown = false;
  const list = async (signal: AbortSignal) => {
    try {
      return await api.list(signal);
    } catch (err) {
      if (err instanceof BffUnreachable && !shown) return null;
      throw err;
    }
  };
  return {
    id: 'github',
    label: 'GitHub repositories',
    listSources: async (_settings, signal) => {
      const repos = await list(signal);
      if (!repos) throw new SourceProviderUnavailable('The BFF does not serve GitHub repositories.');
      shown = true;
      const bff = bffBaseUrl(base, pageOrigin());
      return repos.map((repo) => githubRepoSource(repo, bff));
    },
    addSource: {
      label: 'Analyse a GitHub repository',
      placeholder: 'owner/name or https://github.com/owner/name',
      hint: 'A public repository: the BFF downloads it and builds its model with Model.',
      submit: async (input, _settings, signal) => {
        await api.add(normaliseGithubRepo(input), signal);
      },
    },
    pollMs: GITHUB_POLL_MS,
  };
}
