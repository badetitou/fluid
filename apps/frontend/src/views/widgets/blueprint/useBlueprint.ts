import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BlueprintWidget } from '@fluid/shared';
import { useLinkHref } from '../useCellRenderer';
import { relatedKeys, type Blueprint } from './blueprintModel';

export interface BlueprintState {
  /** The key of the element hovered or focused. */
  hovered?: string;
  /** What the hovered element highlights (itself, its calls and accesses), when one is. */
  related?: ReadonlySet<string>;
  selected?: string;
  hover: (key: string | undefined) => void;
  /** Selects an element: highlights it, emits its row on `selected` and opens it in a new column. */
  open: (key: string) => void;
}

/** What is hovered and selected in the blueprint, and what clicking does. */
export function useBlueprint(
  widget: BlueprintWidget,
  blueprint: Blueprint,
  emit: (port: string, value: unknown) => void,
): BlueprintState {
  const [hovered, setHovered] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const navigate = useNavigate();
  const hrefOf = useLinkHref();
  const related = useMemo(
    () => (hovered ? relatedKeys(blueprint, hovered) : undefined),
    [blueprint, hovered],
  );

  const open = useCallback(
    (key: string) => {
      const method = blueprint.methods.find((m) => m.key === key);
      const attribute = method ? undefined : blueprint.attributes.find((a) => a.key === key);
      const row = method?.row ?? attribute?.row;
      if (!row) return;
      setSelected(key);
      emit('selected', row);
      const href = hrefOf(row, method ? widget.linkTo : widget.attributeLinkTo);
      if (href) navigate(href);
    },
    [blueprint, emit, hrefOf, widget.linkTo, widget.attributeLinkTo, navigate],
  );

  return { hovered, related, selected, hover: setHovered, open };
}
