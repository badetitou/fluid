import { contractsOf, themesOf, type FluidPlugin } from '../../entities/plugin';

/** What a plugin brings, as short labels: its widget types, themes, view builders, sources or page actions. */
export function pluginContents(plugin: FluidPlugin): string[] {
  return [
    ...contractsOf(plugin).map((c) => c.type),
    ...themesOf(plugin).map((t) => t.label),
    ...(plugin.manifest.contributes.viewBuilders ?? []).map((b) => b.label),
    ...(plugin.manifest.contributes.sourceProviders ?? []).flatMap((p) => [p.label, ...(p.sources ?? []).map((s) => s.name)]),
    ...(plugin.manifest.contributes.pageActions ?? []).map((a) => a.label),
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
