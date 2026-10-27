import { describe, expect, it } from 'vitest';
import { resolveManifestUrl } from './loader';

describe('plugin manifest URLs', () => {
  it('accepts HTTPS and same-origin manifests', () => {
    expect(resolveManifestUrl('https://plugins.example/theme.json', 'http://localhost:5173').protocol).toBe('https:');
    expect(resolveManifestUrl('/plugins/theme.json', 'http://localhost:5173').href).toBe('http://localhost:5173/plugins/theme.json');
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])('accepts a separate %s development server', (hostname) => {
    const url = `http://${hostname}:5174/manifest.json`;
    expect(resolveManifestUrl(url, 'http://localhost:5173').href).toBe(url);
  });

  it.each([
    ['http://example.com/manifest.json', 'http://localhost:5173'],
    ['http://192.168.1.10:5174/manifest.json', 'http://localhost:5173'],
    ['http://localhost.evil.example/manifest.json', 'http://localhost:5173'],
    ['http://localhost:5174/manifest.json', 'https://fluid.example'],
    ['ftp://localhost:5174/manifest.json', 'http://localhost:5173'],
    ['javascript:alert(1)', 'http://localhost:5173'],
  ])('rejects %s from %s', (url, origin) => {
    expect(() => resolveManifestUrl(url, origin)).toThrow('Plugins are installed');
  });
});