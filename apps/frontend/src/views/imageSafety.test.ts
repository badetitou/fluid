import { describe, it, expect, beforeEach } from 'vitest';
import { checkImageUrl, hostAllowed, isHostTrusted, trustHost } from './imageSafety';

const AVATAR = 'https://rickandmortyapi.com/api/character/avatar/1.jpeg';

describe('checkImageUrl', () => {
  it('accepts an https URL on an allowed host', () => {
    expect(checkImageUrl(AVATAR, ['rickandmortyapi.com']).ok).toBe(true);
  });

  it('accepts any https host when no allowlist is configured', () => {
    expect(checkImageUrl(AVATAR, []).ok).toBe(true);
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:image/svg+xml,<svg/>'],
    ['http://rickandmortyapi.com/a.png'],
    ['//rickandmortyapi.com/a.png'],
    ['/relative/a.png'],
    ['https://user:pass@rickandmortyapi.com/a.png'],
    ['https://evil.example/a.png'],
    [''],
    [42],
  ])('rejects %s', (value) => {
    expect(checkImageUrl(value, ['rickandmortyapi.com']).ok).toBe(false);
  });

  it('allows plain http only on localhost', () => {
    expect(checkImageUrl('http://localhost:4000/a.png', []).ok).toBe(true);
  });
});

describe('hostAllowed', () => {
  it('matches wildcard subdomains but not look-alikes', () => {
    const allowed = ['*.example.org'];
    expect(hostAllowed('cdn.example.org', allowed)).toBe(true);
    expect(hostAllowed('example.org', allowed)).toBe(true);
    expect(hostAllowed('evilexample.org', allowed)).toBe(false);
    expect(hostAllowed('example.org.evil.com', allowed)).toBe(false);
  });
});

describe('trusted hosts', () => {
  beforeEach(() => sessionStorage.clear());

  it('remembers hosts trusted by the user for the session', () => {
    expect(isHostTrusted('rickandmortyapi.com')).toBe(false);
    trustHost('RickAndMortyApi.com');
    expect(isHostTrusted('rickandmortyapi.com')).toBe(true);
  });
});
