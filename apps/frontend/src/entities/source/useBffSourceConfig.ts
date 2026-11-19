import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '../../bff/client';
import { BffHttpError } from '../../bff/http';
import type { BffSourceConfig } from '../../bff/sourcesApi';
import type { SourceAuth } from '../plugin';
import { authPatch, bffSourceName, createAuth, type AuthForm } from './bffAuth';
import { useAuthRequired } from './authRequired';
import { useWritableSources } from '../../store';
import { useSavedSources } from './store';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'The BFF did not answer');
const isNotFound = (e: unknown) => e instanceof BffHttpError && e.status === 404;
const sources = bffClient.sources;

export interface BffSourceConfigResult {
  /** `null` while checking whether a BFF answers; `false` when there is none (enabling is off). */
  available: boolean | null;
  /** The source is routed through the BFF. */
  routed: boolean;
  /** The BFF's config for it (public part only: `hasSecret`, never the secret). */
  config: BffSourceConfig | null;
  busy: boolean;
  error: string | null;
  /** Creates the BFF config (no auth yet, or the OAuth settings the source's plugin ships) and routes the source through it. */
  enable: () => Promise<void>;
  /** Goes back to the direct connection and deletes the BFF config (the local side is cleared even if the BFF fails). */
  disable: () => Promise<void>;
  /** Sends the auth settings; the typed secret goes to the BFF and is kept nowhere here. Resolves to whether it worked. */
  save: (form: AuthForm) => Promise<boolean>;
  /** Removes the stored secret only. Resolves to whether it worked. */
  removeSecret: () => Promise<boolean>;
  /** Removes the stored OAuth client secret only (a public client). Resolves to whether it worked. */
  removeClientSecret: () => Promise<boolean>;
  /** Reads the config again. Resolves to whether it worked. */
  refresh: () => Promise<boolean>;
  /** A sign-in to the source succeeded: restarts its queries (always), then reads the config again. */
  signedIn: (sourceId: string) => Promise<boolean>;
  /** Forgets the stored sign-in of the source and restarts its queries. Resolves to whether it worked. */
  signOut: () => Promise<boolean>;
}

/** Whether a saved source goes through the BFF, and how to turn that on or off and set its auth. */
export function useBffSourceConfig(url: string, name?: string, suggested?: SourceAuth): BffSourceConfigResult {
  const id = useSavedSources((s) => s.saved.find((x) => x.url === url)?.bffSourceId);
  const setBffId = useSavedSources((s) => s.setBffId);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [config, setConfig] = useState<BffSourceConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What a result must still belong to to be applied: the source and config this hook shows now.
  const scope = useRef('');
  scope.current = `${url}|${id ?? ''}`;

  useEffect(() => {
    let cancelled = false;
    sources
      .ping()
      .then(() => !cancelled && setAvailable(true))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setConfig(null);
    setError(null);
    if (!id || available !== true) return;
    let cancelled = false;
    sources
      .get(id)
      .then((c) => !cancelled && setConfig(c))
      .catch((e) => {
        if (cancelled) return;
        setError(errorMessage(e));
        // The config is gone on the BFF side: the source goes back to a direct connection.
        if (isNotFound(e)) setBffId(url, undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [id, available, url, setBffId]);

  /** Runs a BFF call; `apply` only runs when the source and config are still the ones it started for. */
  const run = useCallback(async <T,>(call: () => Promise<T>, apply: (result: T) => void): Promise<boolean> => {
    const started = scope.current;
    setBusy(true);
    setError(null);
    try {
      const result = await call();
      if (scope.current !== started) return false;
      apply(result);
      return true;
    } catch (e) {
      if (scope.current === started) setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(async () => {
    const started = scope.current;
    await run(
      async () => {
        // The BFF honours "Allow changes" for the actions it runs (MCP hosts): it starts as set here.
        const allowWrites = useWritableSources.getState().byUrl[url] === true;
        const created = await sources.create({ name: bffSourceName(url, name), url, allowWrites, ...createAuth(suggested) });
        // Switched source meanwhile: do not leave the config created for the old one behind.
        if (scope.current !== started) void sources.remove(created.id).catch(() => undefined);
        return created;
      },
      (created) => {
        setConfig(created);
        setBffId(url, created.id);
      },
    );
  }, [run, url, name, suggested, setBffId]);

  const disable = useCallback(async () => {
    const started = scope.current;
    setBffId(url, undefined);
    setConfig(null);
    if (!id) return;
    try {
      await sources.remove(id);
    } catch (e) {
      // The local side is already direct again; only warn that the BFF may still hold the config.
      if (!isNotFound(e) && scope.current.startsWith(started.split('|')[0])) {
        setError(`The config may remain on the BFF (could not delete it): ${errorMessage(e)}`);
      }
    }
  }, [id, url, setBffId]);

  const save = useCallback(
    (form: AuthForm) =>
      id ? run(() => sources.update(id, authPatch(form)), setConfig) : Promise.resolve(false),
    [run, id],
  );

  const removeSecret = useCallback(
    () => (id ? run(() => sources.update(id, { secret: null }), setConfig) : Promise.resolve(false)),
    [run, id],
  );

  const removeClientSecret = useCallback(
    () =>
      id ? run(() => sources.update(id, { oauth: { clientSecret: null } }), setConfig) : Promise.resolve(false),
    [run, id],
  );

  const refresh = useCallback(
    () => (id ? run(() => sources.get(id), setConfig) : Promise.resolve(false)),
    [run, id],
  );

  const signedIn = useCallback(
    (signedInId: string) => {
      // The credential changed whether or not the config can be read again: the queries must run anew.
      useAuthRequired.getState().reconnected(signedInId);
      return refresh();
    },
    [refresh],
  );

  const signOut = useCallback(
    () =>
      id
        ? run(
            async () => {
              await sources.signOut(id);
              // Whatever was cached came with the old credential.
              useAuthRequired.getState().reconnected(id);
              return sources.get(id);
            },
            setConfig,
          )
        : Promise.resolve(false),
    [run, id],
  );

  return {
    available,
    routed: Boolean(id),
    config,
    busy,
    error,
    enable,
    disable,
    save,
    removeSecret,
    removeClientSecret,
    refresh,
    signedIn,
    signOut,
  };
}
