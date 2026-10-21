import { useCallback, useMemo, useState } from 'react';
import { App as AntdApp } from 'antd';
import type { ViewSpec } from '@fluid/shared';
import { bffClient, type SavedView } from '../../bff/client';

export interface ViewMutations {
  /** True while a mutation is in flight. */
  busy: boolean;
  rename: (id: string, title: string) => Promise<SavedView | undefined>;
  setDefault: (id: string) => Promise<SavedView | undefined>;
  remove: (id: string) => Promise<boolean>;
  updateSpec: (id: string, spec: ViewSpec, success?: string) => Promise<SavedView | undefined>;
  create: (spec: ViewSpec, success?: string) => Promise<SavedView | undefined>;
}

/**
 * Mutations on saved views (perspectives). Each one reports success or failure
 * with a toast, then calls `onChanged` so the caller can refetch its list.
 * Failures resolve to `undefined` / `false` instead of throwing.
 */
export function useViewMutations(onChanged: () => void): ViewMutations {
  const { message } = AntdApp.useApp();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T>(action: () => Promise<T>, success: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await action();
        message.success(success);
        onChanged();
        return result;
      } catch (err) {
        message.error((err as Error).message);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [message, onChanged],
  );

  return useMemo(
    () => ({
      busy,
      rename: (id, title) => run(() => bffClient.updateView(id, { title }), 'Perspective renamed'),
      setDefault: (id) => run(() => bffClient.updateView(id, { isDefault: true }), 'Default perspective updated'),
      remove: async (id) => (await run(() => bffClient.deleteView(id).then(() => true), 'Perspective deleted')) ?? false,
      updateSpec: (id, spec, success = 'View updated') => run(() => bffClient.updateView(id, { spec }), success),
      create: (spec, success = 'View saved') => run(() => bffClient.createView(spec, false), success),
    }),
    [busy, run],
  );
}
