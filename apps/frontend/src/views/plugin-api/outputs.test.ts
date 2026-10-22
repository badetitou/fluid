import { describe, expect, it, vi } from 'vitest';
import { createOutputsStore, readsOutputs } from './outputs';

describe('outputs store', () => {
  it('keys outputs like query results and notifies on change only', () => {
    const store = createOutputsStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const row = { id: 1 };
    store.emit('people', 'selected', row);
    store.emit('people', 'selected', row);
    expect(store.snapshot()).toEqual({ '@people': { selected: row } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the other ports of a widget', () => {
    const store = createOutputsStore();
    store.emit('w', 'a', 1);
    store.emit('w', 'b', 2);
    expect(store.snapshot()['@w']).toEqual({ a: 1, b: 2 });
  });
});

describe('readsOutputs', () => {
  it('finds output bindings, nested ones included', () => {
    expect(readsOutputs({ data: { query: 'rows' } })).toBe(false);
    expect(readsOutputs({ widgets: [{ data: { query: '@people', path: 'selected' } }] })).toBe(
      true,
    );
  });
});
