// What a mutation does to its concept, read from the verb its name starts with.
// Shared by the introspection (to classify a source's mutations) and by the
// action validation (a delete needs a confirmation).

export type MutationKind = 'create' | 'update' | 'delete' | 'other';

const VERBS: [MutationKind, string[]][] = [
  ['create', ['create', 'add', 'insert', 'new']],
  ['update', ['update', 'edit', 'set', 'patch', 'modify', 'change']],
  ['delete', ['delete', 'remove', 'destroy']],
];

/** The verb a mutation name starts with (`updateTodo`, `delete_todos`) and the rest of the name. */
export function splitMutationName(field: string): { kind: MutationKind; subject: string } {
  for (const [kind, verbs] of VERBS) {
    for (const verb of verbs) {
      // The verb must end at a word boundary: `setTodo`, `set_todo`, not `settings`.
      const match = new RegExp(`^${verb}(?:_|(?=[A-Z]))(.+)$`).exec(field);
      if (match) return { kind, subject: match[1] };
    }
  }
  return { kind: 'other', subject: field };
}
