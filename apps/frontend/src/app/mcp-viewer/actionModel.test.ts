import { describe, expect, it } from 'vitest';
import type { ViewSpec } from '@fluid/shared';
import { actionKeyOf, confirmationOf, withConfirmations } from './actionModel';

const UPDATE = 'mutation($id: ID!, $done: Boolean) { updateTodo(id: $id, input: { completed: $done }) { id completed } }';
const DELETE = 'mutation($id: ID!) { deleteTodo(id: $id) }';
const spec = {
  title: 'Todos',
  queries: {},
  widgets: [],
  actions: { done: { mutation: UPDATE, label: 'Done' }, remove: { mutation: DELETE, confirm: 'Delete this todo?' } },
} as unknown as ViewSpec;

describe('actionModel', () => {
  it('asks before any action, and says a deletion cannot be undone', () => {
    expect(confirmationOf('done', spec.actions!.done)).toBe('Run "Done"? It changes data in the source.');
    expect(confirmationOf('remove', spec.actions!.remove)).toBe('Delete this todo? "remove" deletes data in the source (deleteTodo). This cannot be undone.');
    expect(withConfirmations(spec).actions?.done.confirm).toContain('Run "Done"');
  });

  it('keeps an authored confirmation of an update', () => {
    expect(confirmationOf('x', { mutation: UPDATE, confirm: 'Sure?' } as never)).toBe('Sure?');
  });

  it('finds the action of a mutation, whatever its formatting', () => {
    expect(actionKeyOf(spec, 'mutation ($id: ID!) {\n  deleteTodo(id: $id)\n}')).toBe('remove');
    expect(actionKeyOf(spec, 'mutation { dropAll }')).toBeUndefined();
  });
});
