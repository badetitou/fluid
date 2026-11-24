import { useMemo } from 'react';
import type { GraphExplorerWidget as GraphExplorerSpec } from '@fluid/shared';
import {
  collapseAll,
  emptyGraphSessionState,
  setCollapsedGroup,
  setFocus,
  setOverride,
  toggleExpanded,
  useGraphSessionState,
} from '../../graphSession';
import type { WidgetProps } from '../../plugin-api/types';
import { useRenderedView } from '../../plugin-api/viewContext';
import { ExplorerCanvas } from './ExplorerCanvas';
import { buildFlow } from './graphExplorerFlow';
import { useExplorerLayout } from './useExplorerLayout';
import {
  buildAll,
  canExpand,
  groupKey,
  initialCollapsedGroups,
  limitExpanded,
  visibleGraph,
} from './graphExplorerModel';

const DEFAULT_HEIGHT = 480;
/** Open boxes are expensive: they hold real widgets, so keep only a handful. */
const MAX_EXPANDED = 6;

/**
 * A hierarchical graph whose nodes can be opened AS BOXES IN THE GRAPH. Each box
 * holds fluid widgets reading the node through `$node` and, when the view
 * declares a lazy `detailQuery`, its detail through `$detail`. Expansion,
 * folded groups and focus live in the session store, never in the ViewSpec.
 */
export function GraphExplorerWidget({ widget, data, resolve, emit, fitHeight }: WidgetProps<GraphExplorerSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const view = useRenderedView();
  const edgesData = useMemo(() => (widget.edges ? resolve(widget.edges) : undefined), [widget.edges, resolve]);
  const all = useMemo(() => buildAll(data, edgesData, widget), [data, edgesData, widget]);
  const initial = useMemo(
    () => ({
      ...emptyGraphSessionState,
      expanded: limitExpanded(widget.initialExpanded ?? [], MAX_EXPANDED),
      collapsedGroups: initialCollapsedGroups(all, widget),
    }),
    [all, widget],
  );
  const sessionKey = `${view?.id ?? ''}|${widget.id}|${widget.data.query}`;
  const [session, setSession] = useGraphSessionState(sessionKey, initial);
  const focus =
    session.focus && widget.focusDepth
      ? { key: session.focus, depth: widget.focusDepth, direction: widget.focusDirection ?? 'both' }
      : undefined;
  const explorer = useMemo(
    () => visibleGraph(all, widget, { collapsedGroups: session.collapsedGroups, focus }),
    [all, widget, session.collapsedGroups, focus],
  );
  const layout = useExplorerLayout(explorer, widget);
  const flow = useMemo(
    () =>
      buildFlow(explorer.visible, {
        positions: layout.positions,
        expanded: new Set(session.expanded),
        focus: session.focus,
        direction: widget.direction,
      }),
    [explorer.visible, layout.positions, session.expanded, session.focus, widget.direction],
  );
  const context = useMemo(
    () => ({
      widget,
      resolve,
      emit,
      session,
      setSession,
      groups: [...new Set(all.nodes.map((n) => n.group).filter((g): g is string => !!g))].map(groupKey),
      hidden: explorer.hidden,
      total: all.nodes.length,
      canExpand: (row: Record<string, unknown>) => canExpand(widget, row),
      toggleExpanded: (key: string) =>
        setSession((prev) => ({
          ...prev,
          expanded: limitExpanded(toggleExpanded(prev, key).expanded, MAX_EXPANDED),
        })),
      collapseAll: () => setSession((prev) => collapseAll(prev, prev.expanded)),
      toggleGroup: (group: string) =>
        setSession((prev) => setCollapsedGroup(prev, group, !prev.collapsedGroups.includes(group))),
      toggleFocus: () =>
        setSession((prev) =>
          setFocus(prev, prev.focus ? undefined : typeof prev.overrides?.selectedKey === 'string' ? prev.overrides.selectedKey : undefined),
        ),
      select: (node: (typeof flow.nodes)[number]) => {
        emit('selected', node.data.row);
        setSession((prev) => setOverride(prev, 'selectedKey', node.id));
      },
    }),
    [widget, resolve, emit, session, setSession, all.nodes, explorer.hidden, flow.nodes],
  );
  return <ExplorerCanvas nodes={flow.nodes} edges={flow.edges} context={context} height={height} />;
}
