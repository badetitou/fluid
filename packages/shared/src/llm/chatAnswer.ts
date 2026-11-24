import { chatAnswerSchema, describeIssues, type ViewSpecDraft, type WidgetContract } from '..';
import { extractJson } from './json';
import { validateDraft } from './validateDraft';

// Pure validation of a chat answer: `{ message, view?, suggestView? }`. The
// message and the view are judged separately: a broken view must not cost a
// good text answer.

export type ChatAnswerOk = { ok: true; message: string; suggestView?: boolean; draft?: ViewSpecDraft };
export type ChatAnswerCheck =
  | ChatAnswerOk
  /** `message` is set when only the view is invalid (the text can be kept). */
  | { ok: false; errorText: string; message?: string; suggestView?: boolean };

export function validateChatAnswer(
  content: string,
  catalog: WidgetContract[],
  mutationFields?: string[],
): ChatAnswerCheck {
  let raw: unknown;
  try {
    raw = extractJson(content);
  } catch (err) {
    return { ok: false, errorText: (err as Error).message };
  }
  const parsed = chatAnswerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errorText: describeIssues(parsed.error) };
  const { message, suggestView, view } = parsed.data;
  if (view === undefined || view === null) return { ok: true, message, suggestView };

  const result = validateDraft(JSON.stringify(view), catalog, mutationFields);
  if (!result.ok) return { ok: false, errorText: `"view": ${result.errorText}`, message, suggestView };
  if (result.draft.actions && Object.keys(result.draft.actions).length > 0) {
    return { ok: false, errorText: '"view": actions are not allowed in chat answers', message, suggestView };
  }
  return { ok: true, message, suggestView, draft: result.draft };
}

/** Appended to the message when the view was dropped after a failed repair. */
export const DROPPED_VIEW_NOTE = '_(I could not build a valid view for this answer.)_';
