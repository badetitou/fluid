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
import { nodeColors, networkPalette } from '../network/networkStyle';
import { useSigmaTheme } from '../network/useSigmaTheme';
import { ExplorerCanvas } from './ExplorerCanvas';
import { ExplorerNodeContext } from './GraphExplorerNodeContext';
import { buildAll, canExpand, limitExpanded } from './graphExplorerModel';
import { buildHierarchy, initialHierarchyState } from './hierarchyModel';

const DEFAULT_HEIGHT = 480;
/** Only boxes with real widgets create DOM; keep their number small at any scale. */
const MAX_EXPANDED = 6;

/**
 * An HNode-style explorer: thousands of WebGL nodes, containment drawn as
 * nested boxes, and a handful of widget cards anchored inside the open boxes.
 * Expansion, folding and focus are session-only, never saved in the view.
 */
export function GraphExplorerWidget({ widget, data, resolve, emit, fitHeight }: WidgetProps<GraphExplorerSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const view = useRenderedView();
  const theme = useSigmaTheme('graphExplorer');
  const palette = useMemo(() => networkPalette(theme), [theme]);
  const edgesData = useMemo(() => (widget.edges ? resolve(widget.edges) : undefined), [widget.edges, resolve]);
  const all = useMemo(() => buildAll(data, edgesData, widget), [data, edgesData, widget]);
  const colors = useMemo(() => nodeColors(all, palette), [all, palette]);
  const overview = useMemo(() => buildHierarchy(all, widget), [all, widget]);
  const initial = useMemo(() => {
    const base = initialHierarchyState(overview, widget);
    return {
      ...emptyGraphSessionState,
      expanded: limitExpanded(base.expanded, MAX_EXPANDED),
      collapsedGroups: base.collapsedGroups,
    };
  }, [overview, widget]);
  const sessionKey = `${view?.id ?? ''}|${widget.id}|${widget.data.query}`;
  const [session, setSession] = useGraphSessionState(sessionKey, initial);
  const focus =
    session.focus && widget.focusDepth
      ? { key: session.focus, depth: widget.focusDepth, direction: widget.focusDirection ?? 'both' }
      : undefined;
  const hierarchy = useMemo(
    () => buildHierarchy(all, widget, { expanded: session.expanded, collapsedGroups: session.collapsedGroups, focus }),
    [all, widget, session.expanded, session.collapsedGroups, focus],
  );
  const context = useMemo(
    () => ({
      widget,
      resolve,
      emit,
      session,
      setSession,
      hierarchy,
      groups: hierarchy.containers.map((box) => box.key),
      hidden: hierarchy.hidden,
      total: hierarchy.totalLeaves,
      canExpand: (row: Record<string, unknown>) => canExpand(widget, row),
      toggleExpanded: (key: string) =>
        setSession((prev) => {
          if (hierarchy.byKey.get(key)?.kind !== 'leaf') {
            return setCollapsedGroup(prev, key, !prev.collapsedGroups.includes(key));
          }
          return { ...prev, expanded: limitExpanded(toggleExpanded(prev, key).expanded, MAX_EXPANDED) };
        }),
      collapseAll: () =>
        setSession((prev) => ({
          ...collapseAll(prev, prev.expanded),
          collapsedGroups: hierarchy.containers.map((box) => box.key),
        })),
      toggleFocus: () =>
        setSession((prev) =>
          setFocus(
            prev,
            prev.focus
              ? undefined
              : typeof prev.overrides?.selectedKey === 'string'
                ? prev.overrides.selectedKey
                : undefined,
          ),
        ),
      select: (key: string) => {
        const node = hierarchy.byKey.get(key);
        if (!node) return;
        emit('selected', node.row);
        setSession((prev) => setOverride(prev, 'selectedKey', key));
      },
    }),
    [widget, resolve, emit, session, setSession, hierarchy],
  );

  return (
    <ExplorerNodeContext.Provider value={context}>
      <ExplorerCanvas hierarchy={hierarchy} colors={colors} palette={palette} height={height} />
    </ExplorerNodeContext.Provider>
  );
}
