import { afterEach, describe, expect, it } from 'vitest';
import { antdTokenLookup, resolveCssColor } from './resolveCssColor';

afterEach(() => document.documentElement.style.removeProperty('--t-warn'));

describe('resolveCssColor', () => {
  it('reads the custom property from the root', () => {
    document.documentElement.style.setProperty('--t-warn', ' #faad14 ');
    expect(resolveCssColor('var(--t-warn)')).toBe('#faad14');
  });
  it('falls back, else keeps the input', () => {
    expect(resolveCssColor('var(--t-warn, #123456)')).toBe('#123456');
    expect(resolveCssColor('var(--t-warn)')).toBe('var(--t-warn)');
  });
  it('leaves other values alone', () => {
    expect(resolveCssColor('#fff')).toBe('#fff');
  });
  it('reads antd variables from its tokens (antd scopes them to the app, not the root)', () => {
    const lookup = antdTokenLookup({ colorWarning: '#d89614', colorBgContainer: '#141414' });
    expect(resolveCssColor('var(--ant-color-warning)', undefined, lookup)).toBe('#d89614');
    expect(resolveCssColor('var(--ant-color-bg-container)', undefined, lookup)).toBe('#141414');
    expect(resolveCssColor('var(--ant-color-unknown, #000001)', undefined, lookup)).toBe('#000001');
    expect(lookup('--fluid-primary')).toBeUndefined();
  });
});
