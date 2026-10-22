import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NetworkWidget } from '@fluid/shared';
import { useLinkHref } from '../useCellRenderer';
import { adjacencyOf, focusNetwork } from './focusModel';
import type { Point } from './layoutModel';
import { linkFor, type Network, type NetworkNode } from './networkModel';
import type { Highlight } from './networkStyle';

export interface NetworkView {
  /** The network drawn: all of it, or the neighbourhood of the selection when focused. */
  visible: Network;
  highlight: Highlight;
  hovered?: { node: NetworkNode; at: Point };
  selected?: NetworkNode;
  focused: boolean;
  setFocused: (focused: boolean) => void;
  hover: (key: string, at: Point) => void;
  leave: () => void;
  /** Selects a node: highlights it, emits its row on `selected` and opens it in a new column. */
  select: (key: string) => void;
}

const NO_NEIGHBOURS: ReadonlySet<string> = new Set();

/** What the user hovers, selects and focuses on, and the network drawn as a result. */
export function useNetworkView(
  widget: NetworkWidget,
  network: Network,
  emit: (port: string, value: unknown) => void,
): NetworkView {
  const [hovered, setHovered] = useState<{ key: string; at: Point }>();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const hrefOf = useLinkHref();

  const byKey = useMemo(() => new Map(network.nodes.map((n) => [n.key, n])), [network]);
  const selected = selectedKey === undefined ? undefined : byKey.get(selectedKey);
  const visible = useMemo(
    () =>
      focused && selected
        ? focusNetwork(network, selected.key, widget.focusDepth ?? 2, widget.focusDirection ?? 'both')
        : network,
    [focused, selected, network, widget.focusDepth, widget.focusDirection],
  );
  const adjacency = useMemo(() => adjacencyOf(visible.edges), [visible]);
  const highlight = useMemo<Highlight>(() => {
    if (!hovered) return { neighbours: NO_NEIGHBOURS, selected: selected?.key };
    const around = [...(adjacency.out.get(hovered.key) ?? []), ...(adjacency.in.get(hovered.key) ?? [])];
    return { hovered: hovered.key, neighbours: new Set(around), selected: selected?.key };
  }, [hovered, adjacency, selected]);

  const select = useCallback(
    (key: string) => {
      const node = byKey.get(key);
      if (!node) return;
      setSelectedKey(key);
      emit('selected', node.row);
      const href = hrefOf(node.row, linkFor(node, widget));
      if (href) navigate(href);
    },
    [byKey, emit, hrefOf, widget, navigate],
  );
  const hover = useCallback((key: string, at: Point) => setHovered({ key, at }), []);
  const leave = useCallback(() => setHovered(undefined), []);
  const hoveredNode = hovered && byKey.get(hovered.key);

  return {
    visible,
    highlight,
    hovered: hoveredNode && hovered ? { node: hoveredNode, at: hovered.at } : undefined,
    selected,
    focused,
    setFocused,
    hover,
    leave,
    select,
  };
}
