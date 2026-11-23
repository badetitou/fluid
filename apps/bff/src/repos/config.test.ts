import { describe, expect, it } from 'vitest';
import { readGithubSourceConfig } from './config';

describe('readGithubSourceConfig', () => {
  it('uses the documented defaults', () => {
    expect(readGithubSourceConfig({}, '/home/me')).toEqual({
      modelGraphqlBin: 'model-graphql',
      reposDir: '/home/me/.fluid/data/repos',
      maxRunning: 3,
      maxBytes: 200 * 1024 * 1024,
      enabled: false,
    });
  });

  it('reads the environment', () => {
    const config = readGithubSourceConfig(
      {
        FLUID_MODEL_GRAPHQL_BIN: '/opt/bin/model-graphql',
        FLUID_DATA_DIR: '~/data',
        FLUID_REPOS_MAX_RUNNING: '5',
        FLUID_REPOS_MAX_BYTES: '1000',
        FLUID_REPOS_ENABLED: 'true',
      },
      '/home/me',
    );
    expect(config).toEqual({
      modelGraphqlBin: '/opt/bin/model-graphql',
      reposDir: '/home/me/data/repos',
      maxRunning: 5,
      maxBytes: 1000,
      enabled: true,
    });
    expect(readGithubSourceConfig({ FLUID_REPOS_DIR: '~/r', FLUID_REPOS_ENABLED: '1' }, '/h')).toMatchObject({
      reposDir: '/h/r',
      enabled: true,
    });
  });

  it('treats empty values as unset and rejects invalid numbers', () => {
    expect(readGithubSourceConfig({ FLUID_REPOS_MAX_RUNNING: '', FLUID_REPOS_DIR: '' }, '/h').maxRunning).toBe(3);
    expect(() => readGithubSourceConfig({ FLUID_REPOS_MAX_RUNNING: '0' })).toThrow(/FLUID_REPOS_MAX_RUNNING/);
    expect(() => readGithubSourceConfig({ FLUID_REPOS_MAX_BYTES: 'lots' })).toThrow(/FLUID_REPOS_MAX_BYTES/);
  });
});
