import { create } from 'zustand';
import type { AuthRequired } from './oauth';

interface AuthRequiredState {
  /** BFF source id -> why the user has to sign in to it again, as its last answers said. */
  required: Record<string, AuthRequired>;
  /** BFF source id -> times the user signed in again: the GraphQL client restarts with it, so queries run anew. */
  epoch: Record<string, number>;
  report: (sourceId: string, auth: AuthRequired) => void;
  /** An answer came without the error: the prompt (if any) no longer applies. */
  clear: (sourceId: string) => void;
  /** The user signed in again. */
  reconnected: (sourceId: string) => void;
}

const without = (record: Record<string, AuthRequired>, key: string): Record<string, AuthRequired> => {
  const { [key]: _gone, ...rest } = record;
  return rest;
};

// In memory only. Written by the GraphQL client's exchange and the sign-in hooks; read through `useReconnect`.
export const useAuthRequired = create<AuthRequiredState>()((set, get) => ({
  required: {},
  epoch: {},
  report: (sourceId, auth) => {
    const known = get().required[sourceId];
    if (known?.reason === auth.reason && known.scope === auth.scope) return;
    set({ required: { ...get().required, [sourceId]: auth } });
  },
  clear: (sourceId) => {
    if (get().required[sourceId]) set({ required: without(get().required, sourceId) });
  },
  reconnected: (sourceId) =>
    set({
      required: without(get().required, sourceId),
      epoch: { ...get().epoch, [sourceId]: (get().epoch[sourceId] ?? 0) + 1 },
    }),
}));
