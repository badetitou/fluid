import { BFF_URL } from '../../../../runtime-config';
import { SourceProviderUnavailable, type SourceProvider } from '../../sourceProvider';
import { githubReposApi, type GithubReposApi } from './githubReposApi';
import { bffBaseUrl, githubRepoSource, normaliseGithubRepo } from './model';

/** How often pending repositories are listed again while they are being analysed. */
export const GITHUB_POLL_MS = 3000;

const pageOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin);

/**
 * The built-in `github` provider: the public repositories the BFF analysed with Model, each
 * served over GraphQL by the BFF, and a form to analyse another one. Hidden when the BFF has
 * the GitHub source off (404) or is not there.
 */
export function githubSourceProvider(api: GithubReposApi = githubReposApi, base = BFF_URL): SourceProvider {
  return {
    id: 'github',
    label: 'GitHub repositories',
    listSources: async (_settings, signal) => {
      const repos = await api.list(signal);
      if (!repos) throw new SourceProviderUnavailable('The BFF does not serve GitHub repositories.');
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
