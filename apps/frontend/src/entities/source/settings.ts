import type { SourceGroup, SourceLimits } from '../plugin';

/** What the user set for one source; unset values fall back to the provider's, then to the views'. */
export interface SourceSettings extends SourceLimits {
  /** Ask before loading every row of a list (on unless "don't ask again"). */
  confirmLoadAll?: boolean;
}

/** The row settings in force for a source. */
export interface EffectiveSourceSettings extends SourceLimits {
  confirmLoadAll: boolean;
}

/** The limits the first provider offering the source gives it. */
export function providerLimits(url: string, groups: SourceGroup[]): SourceLimits {
  for (const group of groups) {
    const entry = group.sources.find((s) => s.url === url);
    if (entry?.limits) return entry.limits;
  }
  return {};
}

/** The user's settings over the provider's limits. */
export function effectiveSettings(own: SourceSettings | undefined, defaults: SourceLimits): EffectiveSourceSettings {
  return {
    rowLimit: own?.rowLimit ?? defaults.rowLimit,
    maxPerRequest: own?.maxPerRequest ?? defaults.maxPerRequest,
    confirmLoadAll: own?.confirmLoadAll ?? true,
  };
}

/** A source's settings with a change; a value set to `undefined` (or a non-positive number) is cleared. */
export function updateSettings(own: SourceSettings | undefined, change: Partial<SourceSettings>): SourceSettings {
  const next: SourceSettings = { ...own, ...change };
  for (const key of ['rowLimit', 'maxPerRequest'] as const) {
    const value = next[key];
    if (value === undefined || !Number.isInteger(value) || value <= 0) delete next[key];
  }
  if (next.confirmLoadAll === undefined) delete next.confirmLoadAll;
  return next;
}
