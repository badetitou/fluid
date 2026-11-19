import { FluidApiError, hasAuthRequired, type DraftOutput, type FluidErrorKind, QueryResult, RunOutput, SourceInfo, SpecInfo, ViewRow } from './fluidApi';

// Pure formatting of what the MCP tools tell the model.

/** Rows requested when the caller gives no `take`. */
export const DEFAULT_TAKE = 100;
/** Largest structuredContent (serialized) returned; beyond it the tool errors and asks for a lower `take`. */
export const MAX_RESULT_BYTES = 256 * 1024;

/** A source URL as origin + path: never userinfo, query or hash. */
export function safeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    return '(invalid url)';
  }
}

/** Null when the value fits MAX_RESULT_BYTES, else the size in KB. */
export function oversizeKb(value: unknown): number | null {
  const bytes = Buffer.byteLength(JSON.stringify(value));
  return bytes > MAX_RESULT_BYTES ? Math.ceil(bytes / 1024) : null;
}

/** Any query of a successful run that needs a sign-in (some queries may have worked, others not). */
export const needsSignIn = (run: RunOutput): boolean => Object.values(run.results).some(hasAuthRequired);

/** Why a run cannot go to the host: a missing sign-in (some queries may have worked) or a result over the cap. */
export function deliveryError(run: RunOutput): FluidApiError | null {
  if (needsSignIn(run)) return new FluidApiError('auth-required', 'sign-in required');
  const kb = oversizeKb(run);
  if (kb !== null) return new FluidApiError('too-large', `The result is too large (${kb} KB, limit 256 KB): call again with a lower take.`);
  return null;
}

export function summarizeSources(sources: SourceInfo[]) {
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    url: safeUrl(s.url),
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

function queryLine(name: string, result: QueryResult): string {
  const n = result.errors?.length ?? 0;
  // Upstream error text is untrusted: only a count (and a fixed label for a missing sign-in) goes to the model.
  const label = hasAuthRequired(result) ? ' (sign-in required)' : '';
  const errors = n > 0 ? `, ${n} error${n > 1 ? 's' : ''}${label}` : '';
  const rows = countRows(result.data);
  const rowText = rows === null ? (result.data === undefined ? 'no data' : 'data') : `${rows} row${rows === 1 ? '' : 's'}`;
  return `- ${name}: ${rowText}${errors}`;
}

/** One-line recap for run_queries, whose payload is for the viewer. */
export function summarizeRunShort(run: RunOutput): string {
  const n = Object.keys(run.results).length;
  const failed = Object.values(run.results).filter((r) => (r.errors?.length ?? 0) > 0).length;
  return `Ran ${n} quer${n === 1 ? 'y' : 'ies'}${failed ? `, ${failed} with errors` : ''}${run.skipped?.length ? `, ${run.skipped.length} skipped` : ''}.`;
}

export function summarizeRun(spec: SpecInfo, run: RunOutput): string {
  const lines = [`View "${spec.title}": ${widgetsLine(spec)}.`];
  const names = Object.keys(run.results);
  lines.push(names.length === 0 ? 'No query ran.' : 'Queries:');
  for (const name of names) lines.push(queryLine(name, run.results[name]));
  if (run.skipped?.length) lines.push(`Skipped (plugin data sources run in the browser): ${run.skipped.join(', ')}.`);
  return lines.join('\n');
}

/** What draft_view tells the model: the run, then the issues to fix or how the user keeps the view. */
export function summarizeDraft(spec: SpecInfo, draft: DraftOutput): string {
  const lines = [summarizeRun(spec, draft)];
  if (draft.issues.length) {
    lines.push('Issues to fix (call draft_view again with a corrected view):', ...draft.issues.map((i) => `- ${i}`));
  } else lines.push('Shown in the viewer: the user can keep it with "Save in fluid".');
  return lines.join('\n');
}

/** Tool error text: fixed wording, ids and names only (no secrets, no upstream bodies). */
export function errorText(
  kind: FluidErrorKind,
  ctx: { baseUrl: string; sourceName?: string; detail?: string; issues?: string[] },
): string {
  switch (kind) {
    case 'unreachable':
      return `fluid is not reachable at ${ctx.baseUrl}: start it with \`npx @badetitou/fluid\``;
    case 'auth-required':
      return `Sign in to ${ctx.sourceName ?? 'the source'} from fluid's settings (Settings → Connection)`;
    case 'timeout':
      return `fluid at ${ctx.baseUrl} did not answer in time`;
    case 'rejected':
      return `fluid refused it:\n${(ctx.issues ?? []).map((i) => `- ${i}`).join('\n') || ctx.detail || ''}`;
    case 'not-found':
      return `Not found: ${ctx.detail ?? 'unknown view or source'}. Use list_views and list_sources for valid ids.`;
    default:
      return ctx.detail ?? 'fluid returned an unexpected answer';
  }
}
