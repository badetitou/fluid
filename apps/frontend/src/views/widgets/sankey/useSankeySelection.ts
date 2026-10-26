import { useCallback, useState } from 'react';
import { linkSelection, nodeSelection } from './sankeyModel';
import type { PlacedLink, PlacedNode, SankeyLayout } from './sankeyLayout';

/** A node or a ribbon of the diagram. */
export type SankeyItem = { kind: 'node'; key: string } | { kind: 'link'; key: string };

export interface SankeySelection {
  hovered?: SankeyItem;
  selected?: SankeyItem;
  hover: (item: SankeyItem | undefined) => void;
  /** Selects a node or a ribbon and emits it on `selected`. */
  choose: (item: SankeyItem) => void;
  /** Whether a node or ribbon stands out: hovered or selected, or touching the hovered or selected node. */
  isLit: (item: SankeyItem) => boolean;
  /** Whether something is hovered or selected, so the rest is dimmed. */
  focusing: boolean;
}

const same = (a: SankeyItem | undefined, b: SankeyItem) => a?.kind === b.kind && a.key === b.key;

function touches(focus: SankeyItem | undefined, item: SankeyItem, layout: SankeyLayout): boolean {
  if (!focus) return false;
  if (same(focus, item)) return true;
  if (focus.kind === 'node' && item.kind === 'link') {
    const link = layout.links.find((l) => l.key === item.key);
    return link?.source === focus.key || link?.target === focus.key;
  }
  if (focus.kind === 'link' && item.kind === 'node') {
    const link = layout.links.find((l) => l.key === focus.key);
    return link?.source === item.key || link?.target === item.key;
  }
  return false;
}

/** What is hovered and selected in a sankey; a click emits the node or ribbon on `selected`. */
export function useSankeySelection(layout: SankeyLayout, emit: (port: string, value: unknown) => void): SankeySelection {
  const [hovered, hover] = useState<SankeyItem>();
  const [selected, setSelected] = useState<SankeyItem>();

  const choose = useCallback(
    (item: SankeyItem) => {
      const found: PlacedNode | PlacedLink | undefined =
        item.kind === 'node' ? layout.nodes.find((n) => n.key === item.key) : layout.links.find((l) => l.key === item.key);
      if (!found) return;
      setSelected(item);
      emit('selected', 'column' in found ? nodeSelection(found) : linkSelection(found));
    },
    [layout, emit],
  );
  const focus = hovered ?? selected;
  const isLit = useCallback((item: SankeyItem) => touches(focus, item, layout), [focus, layout]);

  return { hovered, selected, hover, choose, isLit, focusing: focus !== undefined };
}
