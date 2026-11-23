import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { modelGraphqlCandidates, resolveGithubSource } from './github-source';

const on = { github: true };
const only = (file: string) => (f: string) => f === file;

describe('resolveGithubSource', () => {
  it('turns the source on with the model-graphql found on PATH', () => {
    const bin = join('/usr/local/bin', 'model-graphql');
    const s = resolveGithubSource(on, { PATH: '/usr/local/bin' }, only(bin));
    expect(s).toMatchObject({ enabled: true, env: { FLUID_REPOS_ENABLED: 'true', FLUID_MODEL_GRAPHQL_BIN: bin } });
  });

  it('prefers --model-graphql, then FLUID_MODEL_GRAPHQL_BIN, then PATH, then ~/.cargo/bin', () => {
    expect(modelGraphqlCandidates({ ...on, modelGraphql: '/flag' }, { FLUID_MODEL_GRAPHQL_BIN: '/env' })).toEqual(['/flag']);
    expect(modelGraphqlCandidates(on, { FLUID_MODEL_GRAPHQL_BIN: '/env', PATH: '/p' })).toEqual(['/env']);
    expect(modelGraphqlCandidates(on, { PATH: '/p' }, '/home/u')).toEqual([join('/p', 'model-graphql'), join('/home/u', '.cargo', 'bin', 'model-graphql')]);
  });

  it('stays off without a binary, and says how to install it', () => {
    const s = resolveGithubSource(on, { PATH: '/p' }, () => false);
    expect(s).toMatchObject({ enabled: false, env: {} });
    expect(s.message).toContain('cargo install model-graphql');
  });

  it('is off with --no-github or FLUID_REPOS_ENABLED=false, even with a binary', () => {
    expect(resolveGithubSource({ github: false }, {}, () => true).enabled).toBe(false);
    expect(resolveGithubSource(on, { FLUID_REPOS_ENABLED: 'false' }, () => true).enabled).toBe(false);
  });

  it('reports a --model-graphql that is not executable', () => {
    const s = resolveGithubSource({ ...on, modelGraphql: '/nope' }, {}, () => false);
    expect(s.enabled).toBe(false);
    expect(s.message).toContain('/nope');
  });

  it('keeps an explicit FLUID_REPOS_ENABLED=true even without a binary found', () => {
    expect(resolveGithubSource(on, { FLUID_REPOS_ENABLED: 'true' }, () => false)).toMatchObject({ enabled: true, env: { FLUID_REPOS_ENABLED: 'true' } });
  });
});
