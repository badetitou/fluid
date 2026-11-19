const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A copy of `value` where the list at `path` (or the lists of a pagination wrapper there) keeps `take` rows. */
function trimAt(value: unknown, path: string[], take: number): unknown {
  if (path.length > 0) {
    const [key, ...rest] = path;
    return isRecord(value) && key in value ? { ...value, [key]: trimAt(value[key], rest, take) } : value;
  }
  if (Array.isArray(value)) return value.length > take ? value.slice(0, take) : value;
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Array.isArray(v) && v.length > take ? v.slice(0, take) : v]));
}

/** An answer cut to its first `take` rows on every paged path (see `pagedPaths`). */
export const trimRows = (data: unknown, paths: string[][], take: number): unknown =>
  paths.reduce((acc, path) => trimAt(acc, path, take), data);
