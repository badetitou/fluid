import { describe, expect, it } from 'vitest';
import { decoratorSpecSchema } from '@fluid/shared';
import { BUILTIN_PLUGINS, type FluidPlugin, type GraphDecoratorPlugin } from '../../entities/plugin';
import { matchesFilter, pluginContents } from './model';

const byId = (id: string) => BUILTIN_PLUGINS.find((p) => p.manifest.id === id)!;

describe('plugin manager model', () => {
  it('lists what a plugin brings, whatever its kind', () => {
    expect(pluginContents(byId('fluid-charts'))).toContain('pie');
    expect(pluginContents(byId('fluid-theme-solarized'))).toEqual(['Solarized']);
    expect(pluginContents(byId('fluid-open-views'))).toEqual(['Open Views']);
  });

  it('lists a decorator: label, tags (tag and tagFrom, once each), rules with severity', () => {
    expect(pluginContents(byId('fluid-dependency-cycles'))).toEqual(['Dependency cycles', 'rule: no-cycle (warning)']);
    const decorator = decoratorSpecSchema.parse({
      id: 'layers',
      label: 'Layers',
      concepts: [
        { id: 'ui', tag: 'ui' },
        { id: 'ui2', tag: 'ui' },
        { id: 'domain', tag: 'domain' },
        { id: 'pkg', tagFrom: { field: 'file', pattern: 'src/(\\w+)', prefix: 'pkg:' } },
      ],
      constraints: [{ id: 'big', check: 'forbidden', severity: 'error', message: 'm', from: {}, to: {} }],
    });
    const plugin: FluidPlugin = {
      ...(byId('fluid-dependency-cycles') as GraphDecoratorPlugin),
      manifest: { ...byId('fluid-dependency-cycles').manifest, contributes: { graphDecorators: [decorator] } },
    };
    expect(pluginContents(plugin)).toEqual(['Layers', 'tags: ui, domain, pkg:<file>', 'rule: big (error)']);
  });

  it('filters on name, description and contents, every word', () => {
    expect(matchesFilter(byId('fluid-charts'), '')).toBe(true);
    expect(matchesFilter(byId('fluid-charts'), 'PIE')).toBe(true);
    expect(matchesFilter(byId('fluid-open-views'), 'open views')).toBe(true);
    expect(matchesFilter(byId('fluid-open-views'), 'open pie')).toBe(false);
  });
});
