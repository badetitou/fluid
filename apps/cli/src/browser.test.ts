import { describe, expect, it } from 'vitest';
import { browserCommand, shouldOpenBrowser } from './browser';

describe('shouldOpenBrowser', () => {
  it('opens by default on desktop platforms', () => {
    expect(shouldOpenBrowser(true, {}, 'darwin')).toBe(true);
    expect(shouldOpenBrowser(true, {}, 'win32')).toBe(true);
    expect(shouldOpenBrowser(true, { DISPLAY: ':0' }, 'linux')).toBe(true);
    expect(shouldOpenBrowser(true, { WAYLAND_DISPLAY: 'w' }, 'linux')).toBe(true);
  });
  it('stays closed for --no-open, BROWSER=none, CI and headless Linux', () => {
    expect(shouldOpenBrowser(false, {}, 'darwin')).toBe(false);
    expect(shouldOpenBrowser(true, { BROWSER: 'none' }, 'darwin')).toBe(false);
    expect(shouldOpenBrowser(true, { CI: 'true' }, 'darwin')).toBe(false);
    expect(shouldOpenBrowser(true, {}, 'linux')).toBe(false);
  });
});

describe('browserCommand', () => {
  it('picks the opener per platform', () => {
    expect(browserCommand('darwin', 'u')).toEqual({ command: 'open', args: ['u'] });
    expect(browserCommand('win32', 'u')).toEqual({ command: 'cmd', args: ['/c', 'start', '""', 'u'] });
    expect(browserCommand('linux', 'u')).toEqual({ command: 'xdg-open', args: ['u'] });
  });
});
