/** One-line, actionable message for a startup failure (stack traces only with --verbose). */
export function describeStartupError(err: unknown, port: number): string {
  const e = (err ?? {}) as { code?: unknown; pid?: unknown; dir?: unknown; message?: unknown };
  if (e.code === 'FLUID_DATA_DIR_LOCKED') {
    return `another fluid uses ${String(e.dir)} (pid ${String(e.pid)}): stop it or pass --data-dir`;
  }
  if (e.code === 'EADDRINUSE') return `port ${port} is busy: pass --port`;
  return typeof e.message === 'string' && e.message ? e.message : String(err);
}
