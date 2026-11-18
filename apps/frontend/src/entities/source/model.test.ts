import { describe, expect, it } from 'vitest';
import type { SourceGroup } from '../plugin';
import {
  bffGraphqlUrl,
  forgetSource,
  resolveGraphqlEndpoint,
  setBffSourceId,
  keptSources,
  normalizeSourceUrl,
  rememberSource,
  renameSource,
  sourceLabel,
  sourceName,
  sourceOptions,
  type SavedSource,
} from './model';

const LOCAL = 'http://localhost:8080/graphql';
const RICK = 'https://rickandmortyapi.com/graphql';
const demos: SourceGroup[] = [
  {
    providerId: 'demo-apis',
    label: 'Demo APIs',
    sources: [
      { name: 'Rick and Morty', url: RICK },
      { name: 'Countries', url: 'https://countries.trevorblades.com/' },
    ],
  },
];

describe('sources', () => {
  it('are labelled by name then URL, or by URL alone', () => {
    expect(sourceLabel(LOCAL, 'Moose')).toBe(`Moose — ${LOCAL}`);
    expect(sourceLabel(LOCAL)).toBe(LOCAL);
  });

  it('accept http(s) URLs only', () => {
    expect(normalizeSourceUrl(`  ${LOCAL} `)).toBe(LOCAL);
    expect(normalizeSourceUrl('localhost:8080')).toBeNull();
    expect(normalizeSourceUrl('ftp://host/graphql')).toBeNull();
    expect(normalizeSourceUrl('')).toBeNull();
  });

  it('are kept once, renamed, and forgotten', () => {
    let saved: SavedSource[] = rememberSource([], LOCAL);
    expect(saved).toEqual([{ url: LOCAL, name: undefined }]);
    expect(rememberSource(saved, LOCAL)).toBe(saved);
    saved = rememberSource(saved, LOCAL, ' Moose ');
    expect(saved).toEqual([{ url: LOCAL, name: 'Moose' }]);
    expect(renameSource(saved, LOCAL, '  ')).toEqual([{ url: LOCAL, name: undefined }]);
    expect(forgetSource(saved, LOCAL)).toEqual([]);
  });

  it('take their name from the user, else from a provider', () => {
    expect(sourceName(RICK, [], demos)).toBe('Rick and Morty');
    expect(sourceName(RICK, [{ url: RICK, name: 'Rick' }], demos)).toBe('Rick');
    expect(sourceName(LOCAL, [], demos)).toBeUndefined();
    expect(keptSources([{ url: RICK, name: 'Rick' }, { url: LOCAL }], demos)).toEqual([
      { url: RICK, name: 'Rick', providerName: 'Rick and Morty' },
      { url: LOCAL, providerName: undefined },
    ]);
  });

  it('are offered mine first, current included, then each provider without repeats', () => {
    const groups = sourceOptions(LOCAL, [{ url: RICK }], demos);
    expect(groups.map((g) => g.label)).toEqual(['My sources', 'Demo APIs']);
    expect(groups[0].options.map((o) => o.label)).toEqual([`Rick and Morty — ${RICK}`, LOCAL]);
    expect(groups[1].options.map((o) => o.name)).toEqual(['Countries']);
  });

  it('leave out empty groups', () => {
    expect(sourceOptions(null, [], [{ providerId: 'p', label: 'P', sources: [], error: 'down' }])).toEqual([]);
  });
});

describe('BFF routing', () => {
  it('sets and clears the BFF id, keeping the name, and adds an unknown source', () => {
    const routed = setBffSourceId([{ url: LOCAL, name: 'Moose' }], LOCAL, 'abc');
    expect(routed).toEqual([{ url: LOCAL, name: 'Moose', bffSourceId: 'abc' }]);
    expect(renameSource(routed, LOCAL, 'M')[0].bffSourceId).toBe('abc');
    expect(setBffSourceId(routed, LOCAL, undefined)[0].bffSourceId).toBeUndefined();
    expect(setBffSourceId([], RICK, 'x')).toEqual([{ url: RICK, bffSourceId: 'x' }]);
  });

  it('builds the proxy URL, with or without a trailing slash or a base', () => {
    expect(bffGraphqlUrl('http://localhost:4001/', 'a b')).toBe('http://localhost:4001/api/sources/a%20b/graphql');
    expect(bffGraphqlUrl('', 'x')).toBe('/api/sources/x/graphql');
  });

  it('targets the proxy only for a source routed through the BFF', () => {
    const saved: SavedSource[] = [{ url: LOCAL, bffSourceId: 'abc' }, { url: RICK }];
    expect(resolveGraphqlEndpoint(LOCAL, saved, 'http://bff')).toBe('http://bff/api/sources/abc/graphql');
    expect(resolveGraphqlEndpoint(RICK, saved, 'http://bff')).toBe(RICK);
    expect(resolveGraphqlEndpoint('http://other', saved, 'http://bff')).toBe('http://other');
  });
});
