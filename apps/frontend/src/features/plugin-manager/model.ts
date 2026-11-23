import type { DecoratorSpec } from '@fluid/shared';
import { contractsOf, themesOf, type FluidPlugin } from '../../entities/plugin';

/** What a plugin brings, as short labels: its widget types, themes, view builders, sources, page actions or graph decorators (label, tags, rules with severity). */
export function pluginContents(plugin: FluidPlugin): string[] {
  return [
    ...contractsOf(plugin).map((c) => c.type),
    ...themesOf(plugin).map((t) => t.label),
    ...(plugin.manifest.contributes.viewBuilders ?? []).map((b) => b.label),
    ...(plugin.manifest.contributes.sourceProviders ?? []).flatMap((p) => [p.label, ...(p.sources ?? []).map((s) => s.name)]),
    ...(plugin.manifest.contributes.pageActions ?? []).map((a) => a.label),
    ...(plugin.manifest.contributes.graphDecorators ?? []).flatMap(decoratorContents),
  ];
}

/** A decorator as labels: its name, its tags (one entry), then one entry per rule. */
function decoratorContents(d: DecoratorSpec): string[] {
  const tags = [
    ...new Set(
      d.concepts.flatMap((c) => (c.tag ? [c.tag] : c.tagFrom ? [`${c.tagFrom.prefix ?? ''}<${c.tagFrom.field}>`] : [])),
    ),
  ];
  return [d.label, ...(tags.length ? [`tags: ${tags.join(', ')}`] : []), ...d.constraints.map((c) => `rule: ${c.id} (${c.severity})`),
    ...d.imports.map((i) => `import: ${i.id} (${i.format})`),
  ];
}

/** Whether a plugin matches a filter text (name, description, id or contents; case-insensitive). */
export function matchesFilter(plugin: FluidPlugin, filter: string): boolean {
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const { name, description = '', id } = plugin.manifest;
  const haystack = [name, description, id, ...pluginContents(plugin)].join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}
