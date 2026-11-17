/** Whether `v` is a plain object (not null, not an array): the shape of a JSON object or a row. */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
