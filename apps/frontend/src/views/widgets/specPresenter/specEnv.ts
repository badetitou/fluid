import { useMemo } from 'react';
import type { ViewNode } from '@fluid/shared';
import { pageableNodes } from './parseView';
import type { OpenViewSource } from './sourceModel';
import type { SpecInteraction } from './useSpecInteraction';

/** What every node of a drawn view needs besides itself. */
export interface SpecEnv {
  interaction: SpecInteraction;
  /** The view's provider; undefined when the view came from elsewhere (read-only, no lazy items). */
  source?: OpenViewSource;
  /** Index of each list, columned list and tree of the view (the items route `path`). */
  pageable: ReadonlyMap<ViewNode, number>;
  /** Keys (`forwardKey`) of the forwarded views this one is drawn in, outermost first. */
  trail: readonly string[];
}

const NO_TRAIL: readonly string[] = [];

/** The environment of the view whose root is `root`. */
export function useSpecEnv(
  root: ViewNode | undefined,
  interaction: SpecInteraction,
  source: OpenViewSource | undefined,
  trail: readonly string[] = NO_TRAIL,
): SpecEnv {
  const pageable = useMemo(() => (root ? pageableNodes(root) : new Map<ViewNode, number>()), [root]);
  return useMemo(() => ({ interaction, source, pageable, trail }), [interaction, source, pageable, trail]);
}
