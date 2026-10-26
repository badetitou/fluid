import { useCallback, useContext, useMemo, useState } from 'react';
import type { SpecFluidRef } from '@fluid/shared';
import { OpenableConceptsContext, useNavigationHref } from '../../../navigation/columnPath';
import { openableConcept, refKey } from './model';

/** What every part of a Spec-Fluid tab needs to make its entities clickable. */
export interface SpecInteraction {
  /** Href opening the entity in the next column, when its type can be opened. */
  hrefOf: (ref: SpecFluidRef | undefined) => string | undefined;
  /** Emits the entity on `selected` and highlights it. */
  select: (ref: SpecFluidRef | undefined) => void;
  /** Key of the entity last selected (`refKey`). */
  selected?: string;
}

/** Links and selection of the entities of a tab; `emit` publishes them on `selected`. */
export function useSpecInteraction(emit: (port: string, value: unknown) => void): SpecInteraction {
  const hrefFor = useNavigationHref();
  const openable = useContext(OpenableConceptsContext);
  const [selected, setSelected] = useState<string>();
  const hrefOf = useCallback(
    (ref: SpecFluidRef | undefined) => {
      const concept = openableConcept(ref, openable);
      return concept && ref ? hrefFor(concept, ref.id) : undefined;
    },
    [hrefFor, openable],
  );
  const select = useCallback(
    (ref: SpecFluidRef | undefined) => {
      if (!ref) return;
      setSelected(refKey(ref));
      emit('selected', ref.type ? { id: ref.id, type: ref.type } : { id: ref.id });
    },
    [emit],
  );
  return useMemo(() => ({ hrefOf, select, selected }), [hrefOf, select, selected]);
}
