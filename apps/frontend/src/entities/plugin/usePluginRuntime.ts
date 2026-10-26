import { useEffect, useMemo, useState } from 'react';
import { BUILTIN_PLUGINS } from './builtin';
import { loadPluginModule } from './loader';
import { installedPlugin, type ModuleProvided } from './model';
import { usePluginStore } from './store';
import type { FluidPlugin, PluginLoadState } from './types';

type Loaded = { load: PluginLoadState; provided?: ModuleProvided };

/**
 * Loads the modules of the installed plugins (once per manifest URL and
 * version) and returns every plugin, built-in first. Mounted once, by the app.
 */
export function usePluginRuntime(): FluidPlugin[] {
  const installed = usePluginStore((s) => s.installed);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});

  useEffect(() => {
    for (const plugin of installed) {
      const key = `${plugin.url}@${plugin.manifest.version}`;
      if (!plugin.manifest.module || loaded[key]) continue;
      setLoaded((l) => ({ ...l, [key]: { load: { status: 'loading' } } }));
      loadPluginModule(plugin.url, plugin.manifest)
        .then((provided) =>
          setLoaded((l) => ({ ...l, [key]: { load: { status: 'ready' }, provided } })),
        )
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          setLoaded((l) => ({ ...l, [key]: { load: { status: 'error', message } } }));
        });
    }
  }, [installed, loaded]);

  return useMemo(
    () => [
      ...BUILTIN_PLUGINS,
      ...installed.map((p) => {
        const entry = loaded[`${p.url}@${p.manifest.version}`];
        return installedPlugin(p, entry?.load ?? { status: 'loading' }, entry?.provided);
      }),
    ],
    [installed, loaded],
  );
}
