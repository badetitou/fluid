import { describe, it, expect } from 'vitest';
import { parseMutationDocument } from './document';

describe('parseMutationDocument', () => {
  it('reads the root fields and the declared variables', () => {
    const parsed = parseMutationDocument(`
      # Mark a todo done
      mutation Done($id: ID!, $input: UpdateTodoInput!, $note: String = "ok", $tags: [String!]) {
        updateTodo(id: $id, input: $input) { id completed user { id } }
        log: logEvent(name: "todo, done") @include(if: true)
      }`);
    expect(parsed).toEqual({
      ok: true,
      document: {
        fields: ['updateTodo', 'logEvent'],
        variables: [
          { name: 'id', type: 'ID!', required: true },
          { name: 'input', type: 'UpdateTodoInput!', required: true },
          { name: 'note', type: 'String', required: false },
          { name: 'tags', type: '[String!]', required: false },
        ],
      },
    });
  });

  it('accepts an anonymous mutation without variables', () => {
    expect(parseMutationDocument('mutation { reset }')).toEqual({ ok: true, document: { fields: ['reset'], variables: [] } });
  });

  it('treats a required list as required', () => {
    const parsed = parseMutationDocument('mutation($ids: [ID!]!) { deleteTodos(ids: $ids) }');
    expect(parsed.ok && parsed.document.variables).toEqual([{ name: 'ids', type: '[ID!]!', required: true }]);
  });

  it('rejects queries, several operations and fragments', () => {
    expect(parseMutationDocument('{ todos { id } }')).toMatchObject({ ok: false, error: expect.stringContaining('found a query') });
    expect(parseMutationDocument('query Q { todos { id } }')).toMatchObject({ ok: false });
    expect(parseMutationDocument('mutation A { a } mutation B { b }')).toMatchObject({ ok: false, error: expect.stringContaining('exactly one') });
    expect(parseMutationDocument('mutation { a { ...F } } fragment F on T { id }')).toMatchObject({ ok: false });
  });

  it('rejects malformed documents', () => {
    expect(parseMutationDocument('mutation { updateTodo(id: 1) { id }')).toMatchObject({ ok: false });
    expect(parseMutationDocument('mutation($id: ID!')).toMatchObject({ ok: false });
    expect(parseMutationDocument('mutation { }')).toMatchObject({ ok: false, error: expect.stringContaining('no field') });
    expect(parseMutationDocument('')).toMatchObject({ ok: false });
  });
});
