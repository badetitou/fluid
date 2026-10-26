import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ButterflyWidget } from '@fluid/shared';
import { useLinkHref } from '../useCellRenderer';
import { edgesOf, type Butterfly } from './butterflyModel';

export interface ButterflyState {
  selected?: string;
  hovered?: string;
  /** The edges touching the hovered node, else the selected one: drawn highlighted. */
  lit: ReadonlySet<string>;
  hover: (id: string | undefined) => void;
  /** Selects a neighbour: highlights it, emits its row on `selected` and opens it in a new column. */
  open: (id: string) => void;
}

/** What is hovered and selected in the butterfly map, and what clicking a neighbour does. */
export function useButterfly(
  widget: ButterflyWidget,
  butterfly: Butterfly,
  emit: (port: string, value: unknown) => void,
): ButterflyState {
  const [selected, setSelected] = useState<string>();
  const [hovered, setHovered] = useState<string>();
  const navigate = useNavigate();
  const hrefOf = useLinkHref();

  const focus = hovered ?? selected;
  const lit = useMemo(() => (focus ? edgesOf(butterfly, focus) : new Set<string>()), [butterfly, focus]);

  const open = useCallback(
    (id: string) => {
      const node = butterfly.nodes.find((n) => n.id === id);
      if (!node?.row) return;
      setSelected(id);
      emit('selected', node.row);
      const href = hrefOf(node.row, widget.linkTo);
      if (href) navigate(href);
    },
    [butterfly, emit, hrefOf, widget.linkTo, navigate],
  );

  return { selected, hovered, lit, hover: setHovered, open };
}
