import { useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ViewRef } from '@fluid/shared';
import { OpenableConceptsContext, useNavigationHref } from '../../../navigation/columnPath';
import { openableConcept, refKey } from './model';

/** What every part of a view needs to make its entities clickable. */
export interface SpecInteraction {
  /** Href opening the entity in the next column, when its type can be opened. */
  hrefOf: (ref: ViewRef | undefined) => string | undefined;
  /** Emits the entity on `selected` and highlights it. */
  select: (ref: ViewRef | undefined) => void;
  /** Selects the entity and opens it in the next column, when its type can be opened. */
  open: (ref: ViewRef | undefined) => void;
  /** Key of the entity last selected (`refKey`). */
  selected?: string;
}

/** Links and selection of the entities of a view; `emit` publishes them on `selected`. */
export function useSpecInteraction(emit: (port: string, value: unknown) => void): SpecInteraction {
  const hrefFor = useNavigationHref();
  const navigate = useNavigate();
  const openable = useContext(OpenableConceptsContext);
  const [selected, setSelected] = useState<string>();
  const hrefOf = useCallback(
    (ref: ViewRef | undefined) => {
      const concept = openableConcept(ref, openable);
      return concept && ref ? hrefFor(concept, ref.id) : undefined;
    },
    [hrefFor, openable],
  );
  const select = useCallback(
    (ref: ViewRef | undefined) => {
      if (!ref) return;
      setSelected(refKey(ref));
      emit('selected', ref.type ? { id: ref.id, type: ref.type } : { id: ref.id });
    },
    [emit],
  );
  const open = useCallback(
    (ref: ViewRef | undefined) => {
      select(ref);
      const href = hrefOf(ref);
      if (href) navigate(href);
    },
    [select, hrefOf, navigate],
  );
  return useMemo(() => ({ hrefOf, select, open, selected }), [hrefOf, select, open, selected]);
}
