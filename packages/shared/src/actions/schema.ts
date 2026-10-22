import { z } from 'zod';
import { parseMutationDocument } from './document';
import { splitMutationName } from './kind';
import { refErrors } from './refs';

// An action: a named GraphQL mutation a widget can trigger, declared in the view
// spec next to its queries. See docs/architecture/MUTATIONS.md §5.

const actionShape = z.object({
  /** A GraphQL document holding exactly one mutation, e.g. `mutation($id: ID!) { deleteTodo(id: $id) }`. */
  mutation: z.string().min(1),
  /**
   * Values of the mutation's variables: literals, or references resolved when it
   * runs (`$target`, `$form`, `$target.<path>`, `$form.<path>`), at any depth.
   */
  variables: z.record(z.string(), z.unknown()).optional(),
  /** Keys of the view's queries to fetch again once the mutation succeeded. */
  refetch: z.array(z.string().min(1)).optional(),
  /** Question asked before running; required when the mutation deletes. */
  confirm: z.string().min(1).optional(),
  /** Button label, e.g. "Save" (defaults to the action key). */
  label: z.string().min(1).optional(),
});

/** Checks what zod cannot express: the document, its variables, and the confirmation of a delete. */
function checkAction(action: z.infer<typeof actionShape>, ctx: z.RefinementCtx): void {
  const parsed = parseMutationDocument(action.mutation);
  if (!parsed.ok) {
    ctx.addIssue({ code: 'custom', path: ['mutation'], message: parsed.error });
    return;
  }
  const { fields, variables: declared } = parsed.document;
  const provided = action.variables ?? {};
  const names = new Set(declared.map((v) => v.name));
  for (const key of Object.keys(provided)) {
    if (!names.has(key)) {
      ctx.addIssue({ code: 'custom', path: ['variables', key], message: `$${key} is not declared by the mutation.` });
    }
  }
  for (const v of declared) {
    if (v.required && !(v.name in provided)) {
      ctx.addIssue({ code: 'custom', path: ['variables'], message: `The required variable $${v.name} has no value.` });
    }
  }
  for (const issue of refErrors(provided, ['variables'])) ctx.addIssue({ code: 'custom', ...issue });
  const deletes = fields.filter((f) => splitMutationName(f).kind === 'delete');
  if (deletes.length > 0 && !action.confirm) {
    ctx.addIssue({ code: 'custom', path: ['confirm'], message: `${deletes[0]} deletes data: a confirm question is required.` });
  }
}

export const actionSpecSchema = actionShape.superRefine(checkAction);
export type ActionSpec = z.infer<typeof actionSpecSchema>;

/**
 * Cross-checks a view's actions against its queries: every `refetch` key must
 * name one of them. One readable line per problem.
 */
export function checkViewActions(view: {
  queries: Record<string, unknown>;
  actions?: Record<string, ActionSpec>;
}): string[] {
  return Object.entries(view.actions ?? {}).flatMap(([key, action]) =>
    (action.refetch ?? [])
      .filter((query) => !(query in view.queries))
      .map((query) => `actions.${key}.refetch: "${query}" is not a query of the view.`),
  );
}
