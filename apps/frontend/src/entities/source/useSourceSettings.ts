import { useCallback, useMemo } from 'react';
import { sourceOffsetArg } from '../../graphql/introspection';
import { useRootConcepts } from '../../hooks/useConcepts';
import { usePluginSources } from '../plugin';
import { useConnection } from '../../store';
import { effectiveSettings, providerLimits, type EffectiveSourceSettings, type SourceSettings } from './settings';
import { useSourceSettingsStore } from './store';

export interface SourceSettingsResult {
  /** What the user set for the connected source. */
  own: SourceSettings;
  /** The settings in force: the user's, else the provider's. */
  effective: EffectiveSourceSettings;
  /** Defaults the source provider gives (shown as placeholders). */
  defaults: ReturnType<typeof providerLimits>;
  /** The offset argument found in the source's schema (fluid pages with it), if any. */
  offsetArg?: string;
  update: (change: Partial<SourceSettings>) => void;
}

const NO_SETTINGS: SourceSettings = {};

/** The row settings of the connected source, what its schema allows, and how to change them. */
export function useSourceSettings(): SourceSettingsResult {
  const url = useConnection((s) => s.graphqlUrl);
  const own = useSourceSettingsStore((s) => (url ? s.byUrl[url] : undefined)) ?? NO_SETTINGS;
  const updateStore = useSourceSettingsStore((s) => s.update);
  const groups = usePluginSources();
  const { queriesByType } = useRootConcepts();

  const defaults = useMemo(() => (url ? providerLimits(url, groups) : {}), [url, groups]);
  const effective = useMemo(() => effectiveSettings(own, defaults), [own, defaults]);
  const offsetArg = useMemo(() => sourceOffsetArg(queriesByType), [queriesByType]);
  const update = useCallback(
    (change: Partial<SourceSettings>) => {
      if (url) updateStore(url, change);
    },
    [url, updateStore],
  );
  return { own, effective, defaults, offsetArg, update };
}
