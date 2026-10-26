import type { SourceGroup } from '../plugin';

/** A GraphQL source the user kept, with the name they gave it. */
export interface SavedSource {
  url: string;
  name?: string;
}

/** A source as the switcher offers it. */
export interface SourceOption {
  url: string;
  name?: string;
  /** `<name> — <url>`, or the URL alone. */
  label: string;
}

/** The switcher's options under one heading: the user's sources, or one provider's. */
export interface SourceOptionGroup {
  key: string;
  label: string;
  options: SourceOption[];
}

/** `<name> — <url>`, or the URL alone when the source has no name. */
export const sourceLabel = (url: string, name?: string): string => (name ? `${name} — ${url}` : url);

/** The URL typed by the user, trimmed, if it is an http(s) one; else `null`. */
export function normalizeSourceUrl(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

/** Keeps a source: added at the end if new; a given name replaces the one it had. */
export function rememberSource(saved: SavedSource[], url: string, name?: string): SavedSource[] {
  const cleanName = name?.trim() || undefined;
  if (!saved.some((s) => s.url === url)) return [...saved, { url, name: cleanName }];
  if (!cleanName) return saved;
  return saved.map((s) => (s.url === url ? { ...s, name: cleanName } : s));
}

/** Renames a kept source; an empty name removes it. */
export const renameSource = (saved: SavedSource[], url: string, name: string): SavedSource[] =>
  saved.map((s) => (s.url === url ? { url, name: name.trim() || undefined } : s));

/** Forgets a kept source. */
export const forgetSource = (saved: SavedSource[], url: string): SavedSource[] => saved.filter((s) => s.url !== url);

/** The name of a source: the user's, else the first provider's that offers it. */
export function sourceName(url: string, saved: SavedSource[], groups: SourceGroup[]): string | undefined {
  return (
    saved.find((s) => s.url === url)?.name ??
    groups.flatMap((g) => g.sources).find((s) => s.url === url)?.name
  );
}

/** A kept source, with the name a provider gives it when the user gave none. */
export interface KeptSource extends SavedSource {
  providerName?: string;
}

/** The kept sources, each with the name a provider gives it. */
export const keptSources = (saved: SavedSource[], groups: SourceGroup[]): KeptSource[] =>
  saved.map((s) => ({ ...s, providerName: sourceName(s.url, [], groups) }));

const option = (url: string, name?: string): SourceOption => ({ url, name, label: sourceLabel(url, name) });

/**
 * What the switcher offers: the user's sources first (the current one
 * included), then each provider's, without those already listed. Empty groups are left out.
 */
export function sourceOptions(
  current: string | null,
  saved: SavedSource[],
  groups: SourceGroup[],
): SourceOptionGroup[] {
  const mine = current && !saved.some((s) => s.url === current) ? [...saved, { url: current }] : saved;
  const listed = new Set(mine.map((s) => s.url));
  const result: SourceOptionGroup[] = [
    { key: 'mine', label: 'My sources', options: mine.map((s) => option(s.url, sourceName(s.url, saved, groups))) },
  ];
  for (const group of groups) {
    const options = group.sources.filter((s) => !listed.has(s.url)).map((s) => option(s.url, s.name));
    options.forEach((o) => listed.add(o.url));
    result.push({ key: `provider:${group.providerId}`, label: group.label, options });
  }
  return result.filter((g) => g.options.length > 0);
}
