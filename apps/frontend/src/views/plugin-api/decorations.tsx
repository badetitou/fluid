import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { evaluateDecorators, type DecoratedGraph, type DecoratorSpec } from '@fluid/shared';
import { EMPTY_DECORATION_INDEX, indexDecorations, type DecorationIndex } from './decorationModel';

export interface DecorationsValue {
  decorators: DecoratorSpec[];
}

export const DecorationsContext = createContext<DecorationsValue>({ decorators: [] });

/** Makes decorators available to every widget below. */
export function DecorationsProvider({ decorators, children }: { decorators: DecoratorSpec[]; children: ReactNode }) {
  const value = useMemo(() => ({ decorators }), [decorators]);
  return <DecorationsContext.Provider value={value}>{children}</DecorationsContext.Provider>;
}

/**
 * The decorations of a graph under the active decorators; empty without decorators or graph.
 * The caller must memoize `graph`: a new object each render re-evaluates every decorator.
 */
export function useDecorations(graph: DecoratedGraph | undefined): DecorationIndex {
  const { decorators } = useContext(DecorationsContext);
  return useMemo(
    () => (!graph || decorators.length === 0 ? EMPTY_DECORATION_INDEX : indexDecorations(evaluateDecorators(decorators, graph))),
    [decorators, graph],
  );
}
