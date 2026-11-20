import { describe, expect, it } from 'vitest';
import { BUILTIN_PLUGINS } from '../../entities/plugin';
import { matchesFilter, pluginContents } from './model';

const byId = (id: string) => BUILTIN_PLUGINS.find((p) => p.manifest.id === id)!;

describe('plugin manager model', () => {
  it('lists what a plugin brings, whatever its kind', () => {
    expect(pluginContents(byId('fluid-charts'))).toContain('pie');
    expect(pluginContents(byId('fluid-theme-solarized'))).toEqual(['Solarized']);
    expect(pluginContents(byId('fluid-open-views'))).toEqual(['Open Views']);
  });

  it('filters on name, description and contents, every word', () => {
    expect(matchesFilter(byId('fluid-charts'), '')).toBe(true);
    expect(matchesFilter(byId('fluid-charts'), 'PIE')).toBe(true);
    expect(matchesFilter(byId('fluid-open-views'), 'open views')).toBe(true);
    expect(matchesFilter(byId('fluid-open-views'), 'open pie')).toBe(false);
  });
});
