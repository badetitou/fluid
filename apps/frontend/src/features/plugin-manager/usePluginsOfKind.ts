import { useMemo } from 'react';
import { PLUGIN_KINDS, pluginKind, usePlugins, type PluginKind } from '../../entities/plugin';
import { matchesFilter } from './model';

/** The plugins of one kind, with whether they are enabled, matching a filter text. */
export function usePluginsOfKind(kind: PluginKind, filter = '') {
  const entries = usePlugins();
  return useMemo(
    () => entries.filter(({ plugin }) => pluginKind(plugin.manifest) === kind && matchesFilter(plugin, filter)),
    [entries, kind, filter],
  );
}

/** How many plugins of each kind there are, and how many are enabled. */
export function usePluginCounts(): Record<PluginKind, { total: number; enabled: number }> {
  const entries = usePlugins();
  return useMemo(() => {
    const counts = Object.fromEntries(PLUGIN_KINDS.map((k) => [k, { total: 0, enabled: 0 }])) as Record<
      PluginKind,
      { total: number; enabled: number }
    >;
    for (const { plugin, enabled } of entries) {
      const c = counts[pluginKind(plugin.manifest)];
      c.total += 1;
      if (enabled) c.enabled += 1;
    }
    return counts;
  }, [entries]);
}
