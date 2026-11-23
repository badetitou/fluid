import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { evaluateDecorators, type DecoratedGraph, type DecoratorSpec, type SarifLog } from '@fluid/shared';
import { EMPTY_DECORATION_INDEX, indexDecorations, type DecorationIndex } from './decorationModel';

export interface DecorationsValue {
  decorators: DecoratorSpec[];
  /** Parsed logs of the decorators' imports, keyed `${decorator.id}/${import.id}`. */
  imported?: ReadonlyMap<string, SarifLog>;
}

export const DecorationsContext = createContext<DecorationsValue>({ decorators: [] });

/** Makes decorators available to every widget below. */
export function DecorationsProvider({ decorators, imported, children }: DecorationsValue & { children: ReactNode }) {
  const value = useMemo(() => ({ decorators, imported }), [decorators, imported]);
  return <DecorationsContext.Provider value={value}>{children}</DecorationsContext.Provider>;
}

/**
 * The decorations of a graph under the active decorators; empty without decorators or graph.
 * The caller must memoize `graph`: a new object each render re-evaluates every decorator.
 */
export function useDecorations(graph: DecoratedGraph | undefined): DecorationIndex {
  const { decorators, imported } = useContext(DecorationsContext);
  return useMemo(
    () => (!graph || decorators.length === 0 ? EMPTY_DECORATION_INDEX : indexDecorations(evaluateDecorators(decorators, graph, { imported }))),
    [decorators, imported, graph],
  );
}
