import { checkViewActions, safeParseViewSpec, type ViewSpec } from '@fluid/shared';

export type ParsedView = { ok: true; spec: ViewSpec } | { ok: false; error: string };

function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 6)
    .map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('\n');
}

/** Validate the JSON editor's content as a view spec titled `title` for `concept`. */
export function parseViewSpecText(text: string, title: string, concept: string): ParsedView {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, error: 'A title is required.' };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }

  const parsed = safeParseViewSpec(raw);
  if (!parsed.success) return { ok: false, error: `Invalid view spec:\n${formatIssues(parsed.error.issues)}` };
  const actionProblems = checkViewActions(parsed.data);
  if (actionProblems.length) return { ok: false, error: `Invalid view spec:\n${actionProblems.slice(0, 6).join('\n')}` };
  return { ok: true, spec: { ...parsed.data, title: trimmedTitle, concept } };
}
