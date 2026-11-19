import { parseMutationDocument, type ViewSpec } from '@fluid/shared';
import { deletingFields } from '../../views/actions/model';
import { normalizeQuery } from './viewerData';

// View actions in the viewer: each one is confirmed, deletions say so, and a mutation the engine
// sends is matched back to the action it came from (only actions run, through `invoke_action`).

/**
 * The question the viewer asks before an action runs. The view's own `confirm` and `label` may have
 * been written by an assistant: the mutation fields the action really calls are always named.
 */
export function confirmationOf(key: string, action: NonNullable<ViewSpec['actions']>[string]): string {
  const name = action.label ?? key;
  const parsed = parseMutationDocument(action.mutation);
  const fields = parsed.ok ? parsed.document.fields.join(', ') : 'an unknown mutation';
  const deleted = deletingFields(action);
  const lead = action.confirm ? `${action.confirm} ` : '';
  if (deleted.length > 0) return `${lead}"${name}" deletes data in the source (${deleted.join(', ')}). This cannot be undone.`;
  return `${lead}"${name}" changes data in the source (${fields}). Run it?`;
}

/** The spec with a confirmation on every action, so the engine asks before each one. */
export function withConfirmations(spec: ViewSpec): ViewSpec {
  if (!spec.actions) return spec;
  const actions = Object.fromEntries(Object.entries(spec.actions).map(([key, a]) => [key, { ...a, confirm: confirmationOf(key, a) }]));
  return { ...spec, actions };
}

/** The key of the action whose mutation this is, if any. */
export function actionKeyOf(spec: ViewSpec, mutation: string): string | undefined {
  const text = normalizeQuery(mutation);
  return Object.entries(spec.actions ?? {}).find(([, a]) => normalizeQuery(a.mutation) === text)?.[0];
}
