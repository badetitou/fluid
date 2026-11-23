import { afterEach, describe, expect, it } from 'vitest';
import { resolveCssColor } from './resolveCssColor';

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
});
