import { describe, expect, it } from 'vitest';
import type { ProxyResult } from '../sources/proxy';
import { authRequiredResult } from '../sources/oauth/model';
import { createViewActionService, declaredMutationVariables, loggedResult } from './action-service';
import type { ActionLogEntry } from './repository';

const MUTATION = 'mutation($id: ID!, $input: UpdateTodoInput!) { updateTodo(id: $id, input: $input) { id title } }';
const spec = (actions: object) => ({ id: 'v', concept: 'Todo', title: 'Todos', queries: {}, widgets: [], actions });
const ACTIONS = { update: { mutation: MUTATION, variables: { id: '$target.id', input: '$form' } } };

function setup(opts: { allowWrites?: boolean; answer?: ProxyResult; stored?: unknown } = {}) {
  const logged: ActionLogEntry[] = [];
  const sent: unknown[] = [];
  const service = createViewActionService({
    views: { getSpec: async (id) => (id === 'v' ? (opts.stored ?? spec(ACTIONS)) : null) },
    sources: {
      get: async (id) => (id === 's' ? ({ id, allowWrites: opts.allowWrites ?? true } as never) : null),
      runGraphql: async (_id, body) => {
        sent.push(body);
        return opts.answer ?? { status: 200, body: { data: { updateTodo: { id: '1', title: 'New' } } } };
      },
    },
    log: { record: async (e) => void logged.push(e) },
  });
  return { service, logged, sent };
}
const body = { sourceId: 's', variables: { id: '1', input: { title: 'New' }, extra: 'dropped' } };

describe('view action service', () => {
  it('runs the stored mutation with the declared variables only, and logs the run', async () => {
    const { service, logged, sent } = setup();
    expect(await service.invoke('v', 'update', body)).toEqual({ kind: 'ran', data: { updateTodo: { id: '1', title: 'New' } } });
    expect(sent).toEqual([{ query: MUTATION, variables: { id: '1', input: { title: 'New' } } }]);
    expect(logged).toEqual([
      { viewId: 'v', action: 'update', sourceId: 's', variables: { id: '1', input: { title: 'New' } }, ok: true, result: { data: { updateTodo: { id: '1', title: 'New' } } } },
    ]);
  });

  it('refuses when the source does not allow writes, without calling it', async () => {
    const { service, sent, logged } = setup({ allowWrites: false });
    expect(await service.invoke('v', 'update', body)).toEqual({ kind: 'writes-disabled' });
    expect(sent).toHaveLength(0);
    expect(logged).toHaveLength(0);
  });

  it('answers not found for an unknown view, action (even a prototype key) or source', async () => {
    const { service } = setup();
    expect(await service.invoke('x', 'update', body)).toEqual({ kind: 'view-not-found' });
    expect(await service.invoke('v', 'nope', body)).toEqual({ kind: 'action-not-found' });
    expect(await service.invoke('v', 'toString', body)).toEqual({ kind: 'action-not-found' });
    expect(await service.invoke('v', 'update', { ...body, sourceId: 'x' })).toEqual({ kind: 'source-not-found' });
  });

  it('logs a failed run and returns its errors', async () => {
    const { service, logged } = setup({ answer: { status: 200, body: { errors: [{ message: 'nope' }] } } });
    expect(await service.invoke('v', 'update', body)).toEqual({ kind: 'ran', errors: [{ message: 'nope' }] });
    expect(logged[0]).toMatchObject({ ok: false, result: { errors: [{ message: 'nope' }] } });
  });

  it('passes a missing sign-in through', async () => {
    const auth = authRequiredResult('signin');
    const { service } = setup({ answer: auth });
    expect(await service.invoke('v', 'update', body)).toMatchObject({ kind: 'auth-required', status: auth.status });
  });
});

describe('view action service log', () => {
  it('reports a run that worked even when the log write fails', async () => {
    const errors: unknown[] = [];
    const service = createViewActionService({
      views: { getSpec: async () => spec(ACTIONS) },
      sources: { get: async () => ({ allowWrites: true }) as never, runGraphql: async () => ({ status: 200, body: { data: { ok: true } } }) },
      log: { record: async () => Promise.reject(new Error('db down')) },
      onLogError: (e) => void errors.push(e),
    });
    expect(await service.invoke('v', 'update', body)).toEqual({ kind: 'ran', data: { ok: true } });
    expect(errors).toHaveLength(1);
  });
});

describe('declaredMutationVariables', () => {
  it('reads the variables of a single mutation and refuses anything else', () => {
    expect([...declaredMutationVariables(MUTATION)]).toEqual(['id', 'input']);
    expect(() => declaredMutationVariables('query { a }')).toThrow('exactly one mutation');
    expect(() => declaredMutationVariables('mutation A { a } mutation B { b }')).toThrow('exactly one mutation');
  });
});

describe('loggedResult', () => {
  it('keeps small answers and only the size of big ones', () => {
    expect(loggedResult({ data: { a: 1 } })).toEqual({ data: { a: 1 } });
    expect(loggedResult({ data: { a: 'x'.repeat(9000) } })).toMatchObject({ truncated: true, errors: 0 });
  });
});
