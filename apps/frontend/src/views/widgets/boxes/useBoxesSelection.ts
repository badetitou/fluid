import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BoxesWidget } from '@fluid/shared';
import { useLinkHref } from '../useCellRenderer';
import type { BoxesModel } from './boxesModel';

export interface BoxesSelection {
  hovered?: string;
  selected?: string;
  hover: (key: string | undefined) => void;
  /** Selects a box: highlights it, emits its row on `selected` and opens it in a new column. */
  open: (key: string) => void;
}

/** Which box is hovered and which is selected, and what clicking a box does. */
export function useBoxesSelection(
  widget: BoxesWidget,
  model: BoxesModel,
  emit: (port: string, value: unknown) => void,
): BoxesSelection {
  const [hovered, hover] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const navigate = useNavigate();
  const hrefOf = useLinkHref();

  const open = useCallback(
    (key: string) => {
      const item = model.items.get(key);
      if (!item) return;
      setSelected(key);
      emit('selected', item.row);
      const href = hrefOf(item.row, widget.linkTo);
      if (href) navigate(href);
    },
    [model, emit, hrefOf, widget.linkTo, navigate],
  );

  return { hovered, selected, hover, open };
}
