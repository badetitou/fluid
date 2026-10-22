import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { dataBindingSchema, widgetBase } from './common';

// Editing widgets: they write through the view's `actions` (see
// docs/architecture/MUTATIONS.md §7). Read-only while the source does not
// accept writes.

/** How a form field is edited; guessed from the mutation's input type when omitted. */
export const formInputSchema = z.enum(['text', 'textarea', 'number', 'boolean', 'date', 'select']);
export type FormInput = z.infer<typeof formInputSchema>;

export const formFieldSchema = z.object({
  /** Key of the value in the submitted `$form` (dot paths nest it), prefilled from the bound object. */
  key: z.string().min(1),
  label: z.string().min(1).optional(),
  input: formInputSchema.optional(),
  /** Choices of a `select`. */
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const formWidgetSchema = z.object({
  type: z.literal('form'),
  ...widgetBase,
  /** The object edited: prefills the fields and is the action's `$target`. Omit to create. */
  data: dataBindingSchema.optional(),
  /** Key of the view action run on submit, with `$target` (the bound object) and `$form` (the values). */
  action: z.string().min(1),
  /** Fields to edit; inferred from the input object the action passes as `$form` when omitted. */
  fields: z.array(formFieldSchema).optional(),
  submitLabel: z.string().min(1).optional(),
  /** Empty the fields after a successful submit (default: true without `data`, to create several items). */
  reset: z.boolean().optional(),
});
export type FormWidget = z.infer<typeof formWidgetSchema>;

/** A button on each row of a table, running a view action with the row as `$target`. */
export const rowActionSchema = z.object({
  /** Key of the view action. */
  action: z.string().min(1),
  /** Button text (defaults to the action's label). */
  label: z.string().min(1).optional(),
  /** Styled as dangerous (deletions). */
  danger: z.boolean().optional(),
});
export type RowAction = z.infer<typeof rowActionSchema>;

/** How the LLM is told to use the form widget. */
export const formWidgetDoc = `- { "id": string, "type": "form", "title"?: string, "span"?: 1..24,
    "data"?: { "query": ..., "path"?: "<dot path to the object to edit>" }, "action": "<actions key>",
    "fields"?: [ { "key": string, "label"?: string, "input"?: "text"|"textarea"|"number"|"boolean"|"date"|"select",
    "options"?: string[], "required"?: boolean } ], "submitLabel"?: string, "reset"?: boolean }
    EDITS or CREATES an item through a view action (a mutation). On submit it runs "action" with "$target" = the bound
    object and "$form" = the entered values, e.g. variables { "id": "$target.id", "input": "$form" }.
    Bind "data" to the item to edit (detail views, or "@<tableId>" + "selected" to edit the row clicked in a table);
    omit it to create. List only the fields the user should change.`;

const TODO_FIELDS = 'id title completed';

/** Curated views editing todos on the public GraphQLZero API (which answers but does not persist). */
export const todoEditExample: ViewSpec = {
  version: 1,
  id: 'builtin:todo-edit',
  concept: 'Todo',
  scope: 'detail',
  title: 'Edit todo',
  description: 'The todo, and a form to rename it or mark it done.',
  queries: {
    todo: { query: `query FluidTodo($id: ID!) { todo(id: $id) { ${TODO_FIELDS} user { id name } } }` },
  },
  actions: {
    save: {
      mutation: `mutation FluidSaveTodo($id: ID!, $input: UpdateTodoInput!) { updateTodo(id: $id, input: $input) { ${TODO_FIELDS} } }`,
      variables: { id: '$target.id', input: '$form' },
      label: 'Save',
    },
  },
  widgets: [
    {
      id: 'about',
      type: 'descriptions',
      title: 'Todo',
      data: { query: 'todo', path: 'todo' },
      items: [
        { label: 'Title', key: 'title' },
        { label: 'Done', key: 'completed', format: 'boolean' },
        { label: 'Owner', key: 'user.name', linkTo: { concept: 'User', idField: 'user.id' } },
      ],
    },
    {
      id: 'edit',
      type: 'form',
      title: 'Edit',
      data: { query: 'todo', path: 'todo' },
      action: 'save',
      fields: [
        { key: 'title', required: true },
        { key: 'completed', label: 'Done', input: 'boolean' },
      ],
    },
  ],
};

export const todoListExample: ViewSpec = {
  version: 1,
  id: 'builtin:todo-list',
  concept: 'Todo',
  scope: 'list',
  title: 'Todos',
  description: 'Todos to tick off or delete, and a form to add one.',
  queries: {
    todos: { query: `query FluidTodos { todos(options: { paginate: { limit: 20 } }) { data { ${TODO_FIELDS} } } }` },
  },
  actions: {
    done: {
      mutation: `mutation FluidTodoDone($id: ID!) { updateTodo(id: $id, input: { completed: true }) { ${TODO_FIELDS} } }`,
      variables: { id: '$target.id' },
      label: 'Done',
    },
    remove: {
      mutation: 'mutation FluidDeleteTodo($id: ID!) { deleteTodo(id: $id) }',
      variables: { id: '$target.id' },
      confirm: 'Delete this todo?',
      label: 'Delete',
    },
    add: {
      mutation: `mutation FluidAddTodo($input: CreateTodoInput!) { createTodo(input: $input) { ${TODO_FIELDS} } }`,
      variables: { input: '$form' },
      label: 'Add',
    },
  },
  widgets: [
    {
      id: 'todos',
      type: 'table',
      title: 'Todos',
      span: 16,
      data: { query: 'todos', path: 'todos.data' },
      columns: [
        { key: 'id', linkTo: { concept: 'Todo' } },
        { key: 'title' },
        { key: 'completed', title: 'Done', format: 'boolean' },
      ],
      rowActions: [
        { action: 'done', label: 'Done' },
        { action: 'remove', label: 'Delete', danger: true },
      ],
    },
    {
      id: 'new',
      type: 'form',
      title: 'New todo',
      span: 8,
      action: 'add',
      fields: [
        { key: 'title', required: true },
        { key: 'completed', label: 'Done', input: 'boolean' },
      ],
      submitLabel: 'Add',
    },
  ],
};
