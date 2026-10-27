import { describe, expect, it } from 'vitest';
import type { ViewSpec, Widget } from '@fluid/shared';
import { copyWidget, parseCopiedWidget, pasteWidget, serializeCopiedWidget, withAdditions } from './model';

const characters = { query: 'query { characters { results { id name } } }' };
const episodes = { query: 'query { episodes { results { id } } }' };
const todos = { query: 'query { todos { data { id } } }' };
const done = { mutation: 'mutation($id: ID!) { updateTodo(id: $id, input: { completed: true }) { id } }', variables: { id: '$target.id' }, refetch: ['main'] };

const table: Widget = {
  id: 'table',
  type: 'table',
  data: { query: 'main', path: 'characters.results' },
  layout: { x: 0, y: 0, w: 6, h: 4 },
};
const source: ViewSpec = {
  version: 1,
  id: 'v1',
  concept: 'Character',
  title: 'Characters',
  queries: { main: characters, other: episodes },
  widgets: [table],
};

describe('copyWidget', () => {
  it('keeps the queries the widget reads, not the others', () => {
    expect(copyWidget(table, source)).toEqual({ fluid: 'widget', widget: table, queries: { main: characters }, actions: {} });
  });

  it('keeps the actions it runs and the queries they refetch', () => {
    const todoTable: Widget = { id: 't', type: 'table', data: { query: 'other' }, rowActions: [{ action: 'done' }] };
    const copied = copyWidget(todoTable, { queries: { main: todos, other: episodes }, actions: { done, unused: done } });
    expect(Object.keys(copied.queries).sort()).toEqual(['main', 'other']);
    expect(Object.keys(copied.actions)).toEqual(['done']);
  });

  it('follows nested widgets but not `$item` nor widget outputs', () => {
    const accordion: Widget = {
      id: 'acc',
      type: 'accordion',
      data: { query: 'main', path: 'characters.results' },
      titleField: 'name',
      widgets: [{ id: 'inner', type: 'descriptions', data: { query: '$item' }, items: [{ label: 'Name', key: 'name' }] }],
    };
    expect(Object.keys(copyWidget(accordion, source).queries)).toEqual(['main']);
    const linked: Widget = { ...table, data: { query: '@table', path: 'selected' } };
    expect(copyWidget(linked, source).queries).toEqual({});
  });
});

describe('pasteWidget', () => {
  const copied = copyWidget(table, source);

  it('reuses a query the target already has, frees the id and drops the placement', () => {
    const { widget, additions } = pasteWidget(copied, { widgets: [table], queries: { main: characters } });
    expect(widget).toEqual({ id: 'table-2', type: 'table', data: { query: 'main', path: 'characters.results' } });
    expect(additions.queries).toEqual({});
  });

  it('brings the query, renamed when its key means something else there', () => {
    const { widget, additions } = pasteWidget(copied, { widgets: [], queries: { main: episodes } });
    expect(widget.id).toBe('table');
    expect(widget.data).toEqual({ query: 'main-2', path: 'characters.results' });
    expect(additions.queries).toEqual({ 'main-2': characters });
  });

  it('renames actions and the queries they refetch', () => {
    const todoTable: Widget = { id: 't', type: 'table', data: { query: 'main' }, rowActions: [{ action: 'done' }] };
    const todoCopy = copyWidget(todoTable, { queries: { main: todos }, actions: { done } });
    const { widget, additions } = pasteWidget(todoCopy, {
      widgets: [],
      queries: { main: characters },
      actions: { done: { ...done, label: 'Other' } },
    });
    expect(widget).toMatchObject({ data: { query: 'main-2' }, rowActions: [{ action: 'done-2' }] });
    expect(additions.actions['done-2'].refetch).toEqual(['main-2']);
  });
});

describe('withAdditions', () => {
  it('adds queries and actions, without an empty actions record', () => {
    expect(withAdditions(source, { queries: { more: todos }, actions: {} })).toEqual({
      ...source,
      queries: { ...source.queries, more: todos },
    });
    expect(withAdditions(source, { queries: {}, actions: { done } }).actions).toEqual({ done });
  });
});

describe('clipboard text', () => {
  it('round-trips and rejects anything else', () => {
    const copied = copyWidget(table, source);
    expect(parseCopiedWidget(serializeCopiedWidget(copied))).toEqual(copied);
    expect(parseCopiedWidget('hello')).toBeUndefined();
    expect(parseCopiedWidget('{"fluid":"widget"}')).toBeUndefined();
  });
});
