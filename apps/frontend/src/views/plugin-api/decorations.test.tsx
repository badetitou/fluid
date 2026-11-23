import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { decoratorSpecSchema, type DecoratedGraph, type DecoratorSpec } from '@fluid/shared';
import { DecorationsProvider, useDecorations } from './decorations';

const graph: DecoratedGraph = { nodes: [{ key: 'a', kind: 'class', name: 'A' }], edges: [] };
const decorators = [
  decoratorSpecSchema.parse({
    id: 'd',
    label: 'D',
    concepts: [{ id: 'c', match: { kind: 'class' }, tag: 'cls' }],
  }),
];

const wrapper =
  (specs: DecoratorSpec[]) =>
  ({ children }: { children: ReactNode }) => <DecorationsProvider decorators={specs}>{children}</DecorationsProvider>;

describe('useDecorations', () => {
  it('is empty without decorators', () => {
    const { result } = renderHook(() => useDecorations(graph));
    expect(result.current.nodes.size).toBe(0);
  });

  it('is empty without a graph', () => {
    const { result } = renderHook(() => useDecorations(undefined), { wrapper: wrapper(decorators) });
    expect(result.current.nodes.size + result.current.edges.size).toBe(0);
  });

  it('evaluates and indexes, with a stable reference', () => {
    const { result, rerender } = renderHook(() => useDecorations(graph), { wrapper: wrapper(decorators) });
    expect(result.current.nodes.get('a')?.tags).toContain('cls');
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
