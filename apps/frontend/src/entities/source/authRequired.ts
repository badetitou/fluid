import { create } from 'zustand';
import type { AuthRequired } from './oauth';

interface AuthRequiredState {
  /** BFF source id -> why the user has to sign in to it again, as its last answers said. */
  required: Record<string, AuthRequired>;
  /** BFF source id -> keys of the operations whose last answer asked for it: the prompt stays while any remains. */
  failing: Record<string, string[]>;
  /** BFF source id -> times the user signed in again or out: the GraphQL client restarts with it, so queries run anew. */
  epoch: Record<string, number>;
  report: (sourceId: string, auth: AuthRequired, operationKey: string) => void;
  /** An operation answered without the error; the prompt goes once no failing operation is left. */
  succeeded: (sourceId: string, operationKey: string) => void;
  /** The credential of the source changed (signed in again or out): nothing known about it holds any more. */
  reconnected: (sourceId: string) => void;
}

const without = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _gone, ...rest } = record;
  return rest;
};

// In memory only. Written by the GraphQL client's exchange and the sign-in hooks; read through `useReconnect`.
export const useAuthRequired = create<AuthRequiredState>()((set, get) => ({
  required: {},
  failing: {},
  epoch: {},
  report: (sourceId, auth, operationKey) => {
    const keys = get().failing[sourceId] ?? [];
    const known = get().required[sourceId];
    const same = known?.reason === auth.reason && known.scope === auth.scope;
    if (same && keys.includes(operationKey)) return;
    set({
      required: same ? get().required : { ...get().required, [sourceId]: auth },
      failing: keys.includes(operationKey) ? get().failing : { ...get().failing, [sourceId]: [...keys, operationKey] },
    });
  },
  succeeded: (sourceId, operationKey) => {
    const keys = get().failing[sourceId];
    if (!keys?.includes(operationKey)) return;
    const left = keys.filter((k) => k !== operationKey);
    if (left.length) return set({ failing: { ...get().failing, [sourceId]: left } });
    set({ failing: without(get().failing, sourceId), required: without(get().required, sourceId) });
  },
  reconnected: (sourceId) =>
    set({
      required: without(get().required, sourceId),
      failing: without(get().failing, sourceId),
      epoch: { ...get().epoch, [sourceId]: (get().epoch[sourceId] ?? 0) + 1 },
    }),
}));
