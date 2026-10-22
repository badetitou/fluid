import {
  checkActionFields,
  checkActionReferences,
  checkViewActions,
  checkWidgetsAgainstCatalog,
  describeIssues,
  safeParseViewSpecDraft,
  safeParseWidgetDraft,
  type ViewSpecDraft,
  type WidgetContract,
  type WidgetDraft,
} from '@fluid/shared';
import { extractJson } from './client';

export type Validation<T> = { ok: true; draft: T } | { ok: false; errorText: string };

/**
 * Parses a view draft and checks its widgets against the enabled catalog, and
 * its actions against the source's mutations (`mutationFields`, when known).
 */
export function validateDraft(
  content: string,
  catalog: WidgetContract[],
  mutationFields?: string[],
): Validation<ViewSpecDraft> {
  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch (err) {
    return { ok: false, errorText: (err as Error).message };
  }
  const parsed = safeParseViewSpecDraft(raw);
  if (!parsed.success) return { ok: false, errorText: describeIssues(parsed.error) };
  const problems = [
    ...checkWidgetsAgainstCatalog(parsed.data.widgets, catalog),
    ...checkViewActions(parsed.data),
    ...checkActionReferences(parsed.data.widgets, parsed.data.actions, catalog),
    ...checkActionFields(parsed.data.actions, mutationFields),
  ];
  if (problems.length) return { ok: false, errorText: problems.slice(0, 8).join('\n') };
  return { ok: true, draft: parsed.data };
}

/** Parses a widget draft and checks it against the enabled catalog, the view's other widgets and its actions. */
export function validateWidgetDraft(
  content: string,
  catalog: WidgetContract[],
  viewIds: string[],
  viewActions: string[] = [],
): Validation<WidgetDraft> {
  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch (err) {
    return { ok: false, errorText: (err as Error).message };
  }
  const parsed = safeParseWidgetDraft(raw);
  if (!parsed.success) return { ok: false, errorText: describeIssues(parsed.error) };
  const actions = Object.fromEntries(viewActions.map((key) => [key, true]));
  const problems = [
    ...checkWidgetsAgainstCatalog([parsed.data], catalog, 'widget', new Set(viewIds)),
    ...checkActionReferences([parsed.data], actions, catalog, 'widget'),
  ];
  if (problems.length) return { ok: false, errorText: problems.slice(0, 8).join('\n') };
  return { ok: true, draft: parsed.data };
}
