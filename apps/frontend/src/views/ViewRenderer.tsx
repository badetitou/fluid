import type { ReactNode } from 'react';
import { Alert, Card, Col, Empty, Row, Skeleton } from 'antd';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useElementWidth } from '../hooks/useElementWidth';
import { WidgetGrid } from './grid/WidgetGrid';
import { useViewActions } from './actions/useViewActions';
import {
  useOutputsStore,
  useWriteAccess,
  ViewActionsContext,
  ViewActionSpecsContext,
  ViewOutputsContext,
} from './plugin-api';
import { useViewData } from './useViewData';
import { WidgetCard } from './WidgetCard';
import styles from './ViewRenderer.module.css';

const NO_ACTIONS = {};

/** Narrowest a widget may get before the grid drops to fewer columns per row. */
const MIN_WIDGET_WIDTH = 360;

interface ViewRendererProps {
  spec: ViewSpec;
  /** Upper bound on widgets per row, however wide the container gets. */
  maxColumns?: number;
  /** Layout edit mode: widgets are arranged on the grid with the mouse. */
  editingLayout?: boolean;
  /** Receives the rearranged widgets while editing the layout. */
  onWidgetsChange?: (widgets: Widget[]) => void;
  /** While editing the layout: the widget whose options are being edited, and how to pick one. */
  selectedWidgetId?: string;
  onSelectWidget?: (id: string | undefined) => void;
  /**
   * Actions shown in each widget's header. Injected by the caller so the engine
   * knows nothing of the features (assistant, editors) built on top of it.
   * Keep it referentially stable: widget cards are memoised on it.
   */
  renderWidgetActions?: (widget: Widget) => ReactNode;
}

/**
 * Renders a full view spec: runs its queries and lays widgets out. Views whose
 * widgets were arranged by hand (they carry a `layout`) use the cell grid of
 * `WidgetGrid`; the others flow on Ant's 24-column grid by `span`. Either way the
 * layout follows the width actually available to the renderer (not the
 * viewport), so a lone Miller column uses the whole screen while side-by-side
 * columns stack their widgets. Widgets pass values to each other through the
 * view's outputs store (`@<widgetId>` bindings), and write through its actions
 * when the source accepts writes.
 */
export function ViewRenderer({
  spec,
  maxColumns = 3,
  editingLayout = false,
  onWidgetsChange,
  renderWidgetActions,
  selectedWidgetId,
  onSelectWidget,
}: ViewRendererProps) {
  const view = useViewData(spec);
  const outputs = useOutputsStore();
  const runAction = useViewActions(spec, view);
  const writable = useWriteAccess() && Object.keys(spec.actions ?? {}).length > 0;
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const fit = Math.max(1, Math.min(maxColumns, Math.floor(width / MIN_WIDGET_WIDTH)));
  const compact = fit === 1;
  const actions = editingLayout ? undefined : renderWidgetActions;
  const gridLayout = editingLayout || spec.widgets.some((w) => w.layout);

  // Column width (in Ant's 24-unit grid) for each widget. When only one widget
  // fits, stack them full-width; otherwise respect the authored span but never
  // let a widget be narrower than 24/fit (so at most `fit` share a row).
  const columnSpan = (widget: Widget): number =>
    compact ? 24 : Math.max(Math.ceil(24 / fit), Math.min(24, widget.span ?? 24));

  if (view.fetching) {
    return (
      <div ref={containerRef}>
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    );
  }

  return (
    <ViewOutputsContext.Provider value={outputs}>
      <ViewActionSpecsContext.Provider value={spec.actions ?? NO_ACTIONS}>
        <ViewActionsContext.Provider value={writable ? runAction : null}>
          <div ref={containerRef} className={view.refreshing ? styles.refreshing : styles.settled} aria-busy={view.refreshing}>
            {view.error && (
              <Alert
                type="warning"
                showIcon
                title="Some data could not be loaded"
                description={view.error.message}
                className={styles.warning}
              />
            )}
            {gridLayout && (spec.widgets.length > 0 || editingLayout) ? (
              <WidgetGrid
                widgets={spec.widgets}
                editing={editingLayout}
                onChange={onWidgetsChange}
                selectedId={selectedWidgetId}
                onSelect={onSelectWidget}
                stacked={compact}
                renderWidget={(widget) => (
                  <WidgetCard widget={widget} view={view} renderActions={actions} fill />
                )}
              />
            ) : (
              <Row gutter={compact ? [8, 8] : [16, 16]}>
                {spec.widgets.map((widget) => (
                  <Col key={widget.id} span={columnSpan(widget)}>
                    <WidgetCard widget={widget} view={view} renderActions={actions} />
                  </Col>
                ))}
                {spec.widgets.length === 0 && (
                  <Col span={24}>
                    <Empty description="This view has no widgets yet." />
                  </Col>
                )}
              </Row>
            )}
          </div>
        </ViewActionsContext.Provider>
      </ViewActionSpecsContext.Provider>
    </ViewOutputsContext.Provider>
  );
}
