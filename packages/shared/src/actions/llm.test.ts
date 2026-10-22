import { describe, it, expect } from 'vitest';
import { checkActionFields, renderActionsSection, renderMutations, type MutationInfo } from './llm';

const update: MutationInfo = {
  field: 'updateTodo',
  kind: 'update',
  args: [{ name: 'id', type: 'ID!' }, { name: 'input', type: 'UpdateTodoInput!' }],
  returnsConcept: true,
  inputFields: ['title: String', 'completed: Boolean'],
};

describe('renderMutations', () => {
  it('writes one signature line per mutation', () => {
    expect(renderMutations([update, { field: 'deleteTodo', kind: 'delete', args: [{ name: 'id', type: null }] }])).toBe(
      [
        '  - updateTodo(id: ID!, input: UpdateTodoInput!) [update, returns the item (select its fields)]; input fields: title: String, completed: Boolean',
        '  - deleteTodo(id: ?) [delete]',
      ].join('\n'),
    );
  });
});

describe('renderActionsSection', () => {
  it('documents actions with the concept mutations', () => {
    const section = renderActionsSection([update]);
    expect(section).toContain('"actions"');
    expect(section).toContain('updateTodo(id: ID!');
  });

  it('forbids actions when the concept has no mutation', () => {
    expect(renderActionsSection(undefined)).toMatch(/do NOT declare "actions"/);
    expect(renderActionsSection([])).toMatch(/do NOT declare "actions"/);
  });
});

describe('checkActionFields', () => {
  const actions = {
    save: { mutation: 'mutation($id: ID!) { updateTodo(id: $id) { id } }' },
    bad: { mutation: 'mutation { archiveTodo(id: 1) }' },
  };

  it('reports the root fields the source does not have', () => {
    expect(checkActionFields(actions, ['updateTodo', 'deleteTodo'])).toEqual([
      'actions.bad.mutation: "archiveTodo" is not a mutation of the source (available: updateTodo, deleteTodo)',
    ]);
  });

  it('rejects every action of a source without mutations, and checks nothing when unknown', () => {
    expect(checkActionFields(actions, [])).toHaveLength(2);
    expect(checkActionFields(actions, undefined)).toEqual([]);
    expect(checkActionFields(undefined, [])).toEqual([]);
  });
});
