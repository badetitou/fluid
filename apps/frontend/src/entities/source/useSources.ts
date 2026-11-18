import { useCallback, useMemo } from 'react';
import { usePluginSources } from '../plugin';
import { useConnection } from '../../store';
import { keptSources, sourceAuth, sourceName, sourceOptions } from './model';
import { useSavedSources } from './store';

/**
 * The connected source, the ones the user kept and those the source provider
 * plugins offer, and how to switch, name or forget them.
 */
export function useSources() {
  const current = useConnection((s) => s.graphqlUrl);
  const connect = useConnection((s) => s.connect);
  const saved = useSavedSources((s) => s.saved);
  const remember = useSavedSources((s) => s.remember);
  const rename = useSavedSources((s) => s.rename);
  const forget = useSavedSources((s) => s.forget);
  const pluginGroups = usePluginSources();

  const groups = useMemo(() => sourceOptions(current, saved, pluginGroups), [current, saved, pluginGroups]);
  const kept = useMemo(() => keptSources(saved, pluginGroups), [saved, pluginGroups]);
  const currentName = useMemo(
    () => (current ? sourceName(current, saved, pluginGroups) : undefined),
    [current, saved, pluginGroups],
  );

  const currentAuth = useMemo(
    () => (current ? sourceAuth(current, pluginGroups) : undefined),
    [current, pluginGroups],
  );

  /** Connects to a source and keeps it (with its name, if given), and the one left too. */
  const switchTo = useCallback(
    (url: string, name?: string) => {
      if (current) remember(current);
      remember(url, name);
      connect(url);
    },
    [current, remember, connect],
  );

  return { current, currentName, currentAuth, groups, saved: kept, switchTo, rename, forget };
}
