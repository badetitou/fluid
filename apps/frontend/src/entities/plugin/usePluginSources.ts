import { useCallback, useEffect, useRef, useState } from 'react';
import type { SourceEntry } from './manifest';
import type { ActiveSourceProvider } from './model';
import { nextPollDelay } from './sourceProvider';
import { useActiveSourceProviders } from './usePlugins';

/** A provider's add form, its settings already bound; the sources are listed again once it resolves. */
export interface GroupSourceAdder {
  label: string;
  placeholder?: string;
  hint?: string;
  submit: (input: string, signal: AbortSignal) => Promise<void>;
}

/** The sources one provider offers, or why it could not list them. */
export interface SourceGroup {
  providerId: string;
  label: string;
  sources: SourceEntry[];
  error?: string;
  addSource?: GroupSourceAdder;
}

/**
 * Lists one provider's sources. A failed listing keeps the sources listed before
 * (so pending ones stay pending, and keep being polled, through a network blip).
 */
function listGroup(
  { provider, settings }: ActiveSourceProvider,
  signal: AbortSignal,
  refresh: () => void,
  previous: SourceEntry[] = [],
) {
  const adder = provider.addSource;
  const base = {
    providerId: provider.id,
    label: provider.label,
    addSource: adder && {
      label: adder.label,
      placeholder: adder.placeholder,
      hint: adder.hint,
      submit: async (input: string, submitSignal: AbortSignal) => {
        await adder.submit(input, settings, submitSignal);
        refresh();
      },
    },
  };
  return provider.listSources(settings, signal).then(
    (sources): SourceGroup => ({ ...base, sources }),
    (err: unknown): SourceGroup => ({ ...base, sources: previous, error: err instanceof Error ? err.message : String(err) }),
  );
}

/**
 * The sources the enabled source provider plugins offer, one group per
 * provider, in plugin order. Listed again when the providers or their settings
 * change, after a source is added, and every `pollMs` while some are pending
 * (a failed listing keeps the previous sources, so polling goes on).
 */
export function usePluginSources(): SourceGroup[] {
  const providers = useActiveSourceProviders();
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [round, setRound] = useState(0);
  const refresh = useCallback(() => setRound((r) => r + 1), []);
  const last = useRef(groups);
  useEffect(() => {
    last.current = groups;
  }, [groups]);

  useEffect(() => {
    const controller = new AbortController();
    const before = (id: string) => last.current.find((g) => g.providerId === id)?.sources;
    Promise.all(providers.map((p) => listGroup(p, controller.signal, refresh, before(p.provider.id)))).then((listed) => {
      if (!controller.signal.aborted) setGroups(listed);
    });
    return () => controller.abort();
  }, [providers, round, refresh]);

  const delay = nextPollDelay(
    providers.map((p) => p.provider),
    groups,
  );
  useEffect(() => {
    if (delay === undefined) return;
    const timer = setTimeout(refresh, delay);
    return () => clearTimeout(timer);
  }, [delay, groups, refresh]);

  return groups;
}
