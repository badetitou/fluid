import { describe, it, expect } from 'vitest';
import type { InputField } from '../../../graphql/introspection';
import { formInputType, initialValues, inputKindOf, resolveFormFields, toFormValue } from './formModel';

const input = (name: string, typeName: string, extra: Partial<InputField> = {}): InputField => ({
  name,
  description: null,
  typeName,
  typeKind: 'SCALAR',
  isList: false,
  required: false,
  ...extra,
});

const UPDATE = 'mutation($id: ID!, $input: UpdateTodoInput!) { updateTodo(id: $id, input: $input) { id } }';

describe('formInputType', () => {
  it('names the input type the whole form fills', () => {
    expect(formInputType({ mutation: UPDATE, variables: { id: '$target.id', input: '$form' } })).toBe('UpdateTodoInput');
  });

  it('has none when the form is spread over several variables, or without action', () => {
    expect(formInputType({ mutation: UPDATE, variables: { id: '$target.id', input: { title: '$form.title' } } })).toBeUndefined();
    expect(formInputType(undefined)).toBeUndefined();
  });
});

describe('resolveFormFields', () => {
  const fields = [
    input('title', 'String', { required: true }),
    input('completed', 'Boolean'),
    input('priority', 'Int'),
    input('dueAt', 'DateTime'),
    input('tags', 'String', { isList: true }),
    input('owner', 'UserInput', { typeKind: 'INPUT_OBJECT' }),
  ];

  it('edits every scalar field of the input type when none is configured', () => {
    expect(resolveFormFields(undefined, fields)).toEqual([
      { key: 'title', input: 'text', required: true },
      { key: 'completed', input: 'boolean', required: false },
      { key: 'priority', input: 'number', required: false },
      { key: 'dueAt', input: 'date', required: false },
    ]);
  });

  it('completes configured fields with the kind of their input field', () => {
    expect(resolveFormFields([{ key: 'completed', label: 'Done' }, { key: 'note' }], fields)).toEqual([
      { key: 'completed', label: 'Done', input: 'boolean' },
      { key: 'note', input: 'text' },
    ]);
    expect(resolveFormFields([{ key: 'title', input: 'textarea' }], fields)[0].input).toBe('textarea');
  });

  it('maps GraphQL types to input kinds', () => {
    expect(inputKindOf({ typeName: 'Float', typeKind: 'SCALAR' })).toBe('number');
    expect(inputKindOf({ typeName: 'Status', typeKind: 'ENUM' })).toBe('text');
  });
});

describe('form values', () => {
  it('starts from the bound object', () => {
    expect(initialValues([{ key: 'title' }, { key: 'user.name' }], { title: 'Shop', user: { name: 'Ann' } })).toEqual({
      title: 'Shop',
      'user.name': 'Ann',
    });
    expect(initialValues([{ key: 'title' }], null)).toEqual({ title: undefined });
  });

  it('starts a switch off, so an untouched one is still submitted', () => {
    expect(initialValues([{ key: 'completed', input: 'boolean' }], null)).toEqual({ completed: false });
    expect(initialValues([{ key: 'completed', input: 'boolean' }], { completed: true })).toEqual({ completed: true });
  });

  it('nests dot-path keys and leaves untouched fields out', () => {
    expect(toFormValue({ title: 'Shop', 'user.id': '1', 'user.role': 'admin', note: undefined })).toEqual({
      title: 'Shop',
      user: { id: '1', role: 'admin' },
    });
  });

  it('coerces numeric form values to numbers for GraphQL Float/Int fields', () => {
    expect(toFormValue({ price: '42.5', quantity: '3' }, [{ key: 'price', input: 'number' }, { key: 'quantity', input: 'number' }])).toEqual({
      price: 42.5,
      quantity: 3,
    });
    expect(toFormValue({ price: '42.5' }, [{ key: 'price', input: 'text' }])).toEqual({ price: '42.5' });
  });
});
