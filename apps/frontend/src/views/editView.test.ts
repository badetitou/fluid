import { describe, it, expect } from 'vitest';
import { parseViewSpec } from '@fluid/shared';
import type { Concept, ConceptField, ConceptMutation, MutationArg } from '../graphql/introspection';
import { buildUpdateAction, withEditForm } from './editView';

const scalar = (name: string): ConceptField => ({ name, description: null, typeName: 'String', typeKind: 'SCALAR', isList: false, isScalar: true });
const arg = (name: string, type: string | undefined, extra: Partial<MutationArg> = {}): MutationArg => ({
  name,
  type,
  typeName: type?.replace('!', ''),
  required: type?.endsWith('!') ?? true,
  isInput: name === 'input',
  ...extra,
});
const update: ConceptMutation = {
  field: 'updateTodo',
  kind: 'update',
  args: [arg('id', 'ID!'), arg('input', 'UpdateTodoInput!')],
  idArg: 'id',
  inputArg: 'input',
  returnsConcept: true,
};
const todo = (mutation: ConceptMutation | undefined): Concept => ({
  name: 'Todo',
  description: null,
  fields: [scalar('id'), scalar('title')],
  scalarFields: [scalar('id'), scalar('title')],
  relationFields: [],
  queries: { byId: { field: 'todo' } },
  mutations: mutation && { update: mutation, others: [] },
});
const detail = parseViewSpec({ id: 'auto-detail:Todo', concept: 'Todo', title: 'Todo', queries: { todo: { query: 'query($id: ID!) { todo(id: $id) { id title } }' } }, widgets: [] });

describe('buildUpdateAction', () => {
  it('updates the item shown with the form as input', () => {
    expect(buildUpdateAction(todo(update))).toEqual({
      mutation: 'mutation FluidAutoUpdate_Todo($id: ID!, $input: UpdateTodoInput!) { updateTodo(id: $id, input: $input) { id title } }',
      variables: { id: '$target.id', input: '$form' },
      label: 'Save',
    });
  });

  it('gives up when the mutation cannot be called that way', () => {
    expect(buildUpdateAction(todo(undefined))).toBeNull();
    expect(buildUpdateAction(todo({ ...update, returnsConcept: false }))).toBeNull();
    expect(buildUpdateAction(todo({ ...update, args: [...update.args, arg('reason', 'String!')] }))).toBeNull();
    expect(buildUpdateAction(todo({ ...update, args: [arg('id', 'ID!'), arg('input', undefined)] }))).toBeNull();
  });
});

describe('withEditForm', () => {
  it('adds the action and a form bound to the item, as a valid view', () => {
    const view = parseViewSpec(withEditForm(detail, todo(update)));
    expect(Object.keys(view.actions ?? {})).toEqual(['update']);
    expect(view.widgets.at(-1)).toMatchObject({ type: 'form', action: 'update', data: { query: 'todo', path: 'todo' } });
  });

  it('leaves a concept it cannot update untouched', () => {
    expect(withEditForm(detail, todo(undefined))).toBe(detail);
  });
});
