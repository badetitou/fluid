import { useEffect, useState } from 'react';
import type { SourceEntry } from './manifest';
import { useActiveSourceProviders } from './usePlugins';

/** The sources one provider offers, or why it could not list them. */
export interface SourceGroup {
  providerId: string;
  label: string;
  sources: SourceEntry[];
  error?: string;
}

/**
 * The sources the enabled source provider plugins offer, one group per
 * provider, in plugin order. Listed again when the providers or their settings change.
 */
export function usePluginSources(): SourceGroup[] {
  const providers = useActiveSourceProviders();
  const [groups, setGroups] = useState<SourceGroup[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      providers.map(({ provider, settings }) =>
        provider.listSources(settings, controller.signal).then(
          (sources): SourceGroup => ({ providerId: provider.id, label: provider.label, sources }),
          (err: unknown): SourceGroup => ({
            providerId: provider.id,
            label: provider.label,
            sources: [],
            error: err instanceof Error ? err.message : String(err),
          }),
        ),
      ),
    ).then((listed) => {
      if (!controller.signal.aborted) setGroups(listed);
    });
    return () => controller.abort();
  }, [providers]);

  return groups;
}
