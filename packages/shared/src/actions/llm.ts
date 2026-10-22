import { z } from 'zod';
import { parseMutationDocument } from './document';
import type { ActionSpec } from './schema';

// What the LLM is told about a concept's mutations and the view `actions`, and
// how its answer is checked against the source's mutations. Shared by the
// frontend (which sends the mutations) and the BFF (which prompts and checks).

/** One root mutation writing the concept, as the frontend sends it to the BFF. */
export const mutationInfoSchema = z.object({
  field: z.string().min(1),
  kind: z.enum(['create', 'update', 'delete', 'other']),
  args: z.array(z.object({ name: z.string(), type: z.string().nullish() })),
  /** The mutation returns the written item (its fields can be selected). */
  returnsConcept: z.boolean().optional(),
  /** Fields of its input object argument, as "name: Type". */
  inputFields: z.array(z.string()).optional(),
});
export type MutationInfo = z.infer<typeof mutationInfoSchema>;

/** One line per mutation: its signature, what it does, and its input fields. */
export function renderMutations(mutations: MutationInfo[]): string {
  return mutations
    .map((m) => {
      const args = m.args.map((a) => `${a.name}: ${a.type ?? '?'}`).join(', ');
      const input = m.inputFields?.length ? `; input fields: ${m.inputFields.join(', ')}` : '';
      const returns = m.returnsConcept ? ', returns the item (select its fields)' : '';
      return `  - ${m.field}(${args}) [${m.kind}${returns}]${input}`;
    })
    .join('\n');
}

const ACTIONS_DOC = `"actions" (optional, next to "queries") declares the MUTATIONS the view's widgets may run:
  "actions": { "<key>": { "mutation": "<GraphQL document with ONE mutation operation>",
    "variables"?: { "<var>": <literal or reference> }, "refetch"?: ["<queries key>"],
    "confirm"?: "<question asked first>", "label"?: "<button text>" } }
  - References are resolved when the user acts: "$target" (the item acted upon: the form's bound object,
    the table row) and "$form" (the values entered in a form), optionally followed by a dot path
    ("$target.id", "$form.title"). Use "$$" for a literal "$".
  - Every variable the mutation declares as required (Type!) needs a value; declare only variables you pass.
  - "confirm" is REQUIRED for a mutation that deletes. Select the written item's fields in the mutation
    (with its "id"): Fluid patches the displayed data with them. Use "refetch" for created items.
  - Widgets run actions by key: a "form" widget ("action") or a table's "rowActions". Nothing runs without a click,
    and only when the user allowed changes to the source.`;

/** The prompt section about actions: the contract and the concept's mutations, or why there are none. */
export function renderActionsSection(mutations: MutationInfo[] | undefined): string {
  if (!mutations?.length) {
    return 'The concept has no mutation: do NOT declare "actions", nor use "form" widgets or "rowActions".';
  }
  return [
    ACTIONS_DOC,
    'Mutations writing this concept (only call these; take argument and input field names from here):',
    renderMutations(mutations),
    'Add actions only when the user asks to edit, create, delete or act on data.',
  ].join('\n');
}

/**
 * Root fields the actions call that the source does not have. `known` lists
 * every root mutation field of the source; without it nothing is checked.
 */
export function checkActionFields(
  actions: Record<string, ActionSpec> | undefined,
  known: readonly string[] | undefined,
): string[] {
  if (!known) return [];
  const fields = new Set(known);
  return Object.entries(actions ?? {}).flatMap(([key, action]) => {
    const parsed = parseMutationDocument(action.mutation);
    if (!parsed.ok) return [];
    return parsed.document.fields
      .filter((f) => !fields.has(f))
      .map((f) => `actions.${key}.mutation: "${f}" is not a mutation of the source${fields.size ? ` (available: ${[...fields].slice(0, 12).join(', ')})` : ''}`);
  });
}
