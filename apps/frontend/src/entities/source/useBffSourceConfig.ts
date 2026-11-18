import { useCallback, useEffect, useState } from 'react';
import { bffSourcesApi, type BffSourceConfig } from './api';
import { authPatch, bffSourceName, type AuthForm } from './bffAuth';
import { useSavedSources } from './store';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'The BFF did not answer');

export interface BffSourceConfigResult {
  /** `null` while checking whether a BFF answers; `false` when there is none (the option is off). */
  available: boolean | null;
  /** The source is routed through the BFF. */
  routed: boolean;
  /** The BFF's config for it (public part only: `hasSecret`, never the secret). */
  config: BffSourceConfig | null;
  busy: boolean;
  error: string | null;
  /** Creates the BFF config (no auth yet) and routes the source through it. */
  enable: () => Promise<void>;
  /** Deletes the BFF config (and its secret) and goes back to the direct connection. */
  disable: () => Promise<void>;
  /** Sends the auth settings; the typed secret goes to the BFF and is kept nowhere here. */
  save: (form: AuthForm) => Promise<void>;
  /** Removes the stored secret only. */
  removeSecret: () => Promise<void>;
}

/** Whether a saved source goes through the BFF, and how to turn that on or off and set its auth. */
export function useBffSourceConfig(url: string, name?: string): BffSourceConfigResult {
  const id = useSavedSources((s) => s.saved.find((x) => x.url === url)?.bffSourceId);
  const setBffId = useSavedSources((s) => s.setBffId);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [config, setConfig] = useState<BffSourceConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bffSourcesApi
      .ping()
      .then(() => !cancelled && setAvailable(true))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id || available !== true) {
      setConfig(null);
      return;
    }
    let cancelled = false;
    bffSourcesApi
      .get(id)
      .then((c) => !cancelled && setConfig(c))
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e));
        // The config is gone on the BFF side: the source goes back to a direct connection.
        if (errorMessage(e).includes('→ 404')) setBffId(url, undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [id, available, url, setBffId]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(
    () =>
      run(async () => {
        const created = await bffSourcesApi.create({ name: bffSourceName(url, name), url, authKind: 'none' });
        setConfig(created);
        setBffId(url, created.id);
      }),
    [run, url, name, setBffId],
  );

  const disable = useCallback(
    () =>
      run(async () => {
        if (id) await bffSourcesApi.remove(id).catch((e) => (errorMessage(e).includes('→ 404') ? undefined : Promise.reject(e)));
        setBffId(url, undefined);
        setConfig(null);
      }),
    [run, id, url, setBffId],
  );

  const save = useCallback(
    (form: AuthForm) =>
      run(async () => {
        if (id) setConfig(await bffSourcesApi.update(id, authPatch(form)));
      }),
    [run, id],
  );

  const removeSecret = useCallback(
    () =>
      run(async () => {
        if (id) setConfig(await bffSourcesApi.update(id, { secret: null }));
      }),
    [run, id],
  );

  return { available, routed: Boolean(id), config, busy, error, enable, disable, save, removeSecret };
}
