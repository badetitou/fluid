import type { FluidErrorKind, QueryResult, RunOutput, SourceInfo, SpecInfo, ViewRow } from './fluidApi';

// Pure formatting of what the MCP tools tell the model.

export function summarizeSources(sources: SourceInfo[]) {
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    authKind: s.authKind,
    ...(s.authKind === 'oauth' ? { signedIn: s.oauth?.signedIn ?? false } : {}),
  }));
}

export function summarizeViews(views: ViewRow[]) {
  return views.map((v) => ({ id: v.id, title: v.title, concept: v.concept }));
}

/** Rows of a GraphQL `data`: the first array found within 3 levels, or null when there is none. */
export function countRows(data: unknown, depth = 3): number | null {
  if (Array.isArray(data)) return data.length;
  if (depth === 0 || typeof data !== 'object' || data === null) return null;
  for (const value of Object.values(data)) {
    const n = countRows(value, depth - 1);
    if (n !== null) return n;
  }
  return null;
}

function widgetsLine(spec: SpecInfo): string {
  if (spec.widgets.length === 0) return 'no widgets';
  const counts = new Map<string, number>();
  for (const w of spec.widgets) counts.set(w.type ?? 'widget', (counts.get(w.type ?? 'widget') ?? 0) + 1);
  const kinds = [...counts].map(([type, n]) => (n > 1 ? `${type} x${n}` : type)).join(', ');
  return `${spec.widgets.length} widget${spec.widgets.length > 1 ? 's' : ''} (${kinds})`;
}

function firstErrorMessage(errors: unknown[]): string {
  const message = (errors[0] as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : 'unknown error';
}

function queryLine(name: string, result: QueryResult): string {
  const n = result.errors?.length ?? 0;
  const errors = n > 0 ? `, ${n} error${n > 1 ? 's' : ''}: ${firstErrorMessage(result.errors ?? [])}` : '';
  const rows = countRows(result.data);
  const rowText = rows === null ? (result.data === undefined ? 'no data' : 'data') : `${rows} row${rows === 1 ? '' : 's'}`;
  return `- ${name}: ${rowText}${errors}`;
}

export function summarizeRun(spec: SpecInfo, run: RunOutput): string {
  const lines = [`View "${spec.title}": ${widgetsLine(spec)}.`];
  const names = Object.keys(run.results);
  lines.push(names.length === 0 ? 'No query ran.' : 'Queries:');
  for (const name of names) lines.push(queryLine(name, run.results[name]));
  if (run.skipped?.length) lines.push(`Skipped (plugin data sources run in the browser): ${run.skipped.join(', ')}.`);
  return lines.join('\n');
}

/** Tool error text: fixed wording, ids and names only (no secrets, no upstream bodies). */
export function errorText(
  kind: FluidErrorKind,
  ctx: { baseUrl: string; sourceName?: string; detail?: string },
): string {
  switch (kind) {
    case 'unreachable':
      return `fluid is not reachable at ${ctx.baseUrl}: start it with \`npx @badetitou/fluid\``;
    case 'auth-required':
      return `Sign in to ${ctx.sourceName ?? 'the source'} from fluid's settings (Settings → Connection)`;
    case 'not-found':
      return `Not found: ${ctx.detail ?? 'unknown view or source'}. Use list_views and list_sources for valid ids.`;
    default:
      return ctx.detail ?? 'fluid returned an unexpected answer';
  }
}
