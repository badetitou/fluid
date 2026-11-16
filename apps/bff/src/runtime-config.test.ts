import { describe, expect, it } from 'vitest';
import { parseImageHosts, renderRuntimeConfig } from './runtime-config';

function evalConfig(js: string): unknown {
  const w: { __FLUID_CONFIG__?: unknown } = {};
  new Function('window', js)(w);
  return w.__FLUID_CONFIG__;
}

describe('parseImageHosts', () => {
  it('splits, trims and drops empties', () => {
    expect(parseImageHosts(' a.com, ,*.b.org,')).toEqual(['a.com', '*.b.org']);
  });
  it('handles undefined', () => {
    expect(parseImageHosts(undefined)).toEqual([]);
  });
  it('strips quotes and backslashes', () => {
    expect(parseImageHosts('a"b.com,\\c.com')).toEqual(['ab.com', 'c.com']);
  });
});

describe('renderRuntimeConfig', () => {
  it('uses defaults and same-origin bffUrl', () => {
    expect(evalConfig(renderRuntimeConfig({}))).toEqual({
      bffUrl: '',
      defaultGraphqlUrl: 'https://rickandmortyapi.com/graphql',
      imageHosts: [],
    });
  });
  it('reads env values', () => {
    expect(
      evalConfig(
        renderRuntimeConfig({
          FLUID_DEFAULT_GRAPHQL_URL: 'https://x.test/graphql',
          FLUID_IMAGE_HOSTS: 'a.com,b.com',
        }),
      ),
    ).toMatchObject({ defaultGraphqlUrl: 'https://x.test/graphql', imageHosts: ['a.com', 'b.com'] });
  });
  it('cannot be broken out of by hostile values', () => {
    const js = renderRuntimeConfig({ FLUID_DEFAULT_GRAPHQL_URL: '"};alert(1);//</script>' });
    expect(js).not.toContain('</script>');
    expect(evalConfig(js)).toMatchObject({ defaultGraphqlUrl: '"};alert(1);//</script>' });
  });
});
