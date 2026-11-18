import type { PrefRepository } from './repository';

// App preferences (navbar side, …), independent of any transport.

export interface PrefService {
  all(): Promise<Record<string, unknown>>;
  /** Merges the given preferences into the stored ones; resolves to all of them. */
  put(prefs: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export function createPrefService(prefs: PrefRepository): PrefService {
  return {
    all: () => prefs.all(),
    async put(entries) {
      await prefs.putAll(entries);
      return prefs.all();
    },
  };
}
