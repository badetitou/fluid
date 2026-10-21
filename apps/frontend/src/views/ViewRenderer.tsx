import { useState } from 'react';
import { Alert, Card, Col, Dropdown, Empty, Row, Skeleton } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useViewData, type ViewData } from './useViewData';
import { WidgetBody } from './WidgetRenderer';
import { WidgetGrid } from './WidgetGrid';
import { WidgetEditorModal } from '../components/WidgetEditorModal';
import type { ConceptSchemaPayload, SavedView } from '../bff/client';
import { useElementHeight, useElementWidth } from '../hooks/useElementWidth';

/** Narrowest a widget may get before the grid drops to fewer columns per row. */
const MIN_WIDGET_WIDTH = 360;

interface ViewRendererProps {
  spec: ViewSpec;
  concept?: string;
  schema?: ConceptSchemaPayload;
  viewId?: string;
  onWidgetUpdated?: (updatedView: SavedView) => void;
  /** Upper bound on widgets per row, however wide the container gets. */
  maxColumns?: number;
  /** Layout edit mode: widgets are arranged on the grid with the mouse. */
  editingLayout?: boolean;
  /** Receives the rearranged widgets while editing the layout. */
  onWidgetsChange?: (widgets: Widget[]) => void;
}

/**
 * Renders a full view spec: runs its queries and lays widgets out. Views whose
 * widgets were arranged by hand (they carry a `layout`) use the cell grid of
 * `WidgetGrid`; the others flow on Ant's 24-column grid by `span`. Either way the
 * layout follows the width actually available to the renderer (not the
 * viewport), so a lone Miller column uses the whole screen while side-by-side
 * columns stack their widgets.
 */
export function ViewRenderer({
  spec,
  concept,
  schema,
  viewId,
  onWidgetUpdated,
  maxColumns = 3,
  editingLayout = false,
  onWidgetsChange,
}: ViewRendererProps) {
  const view = useViewData(spec);
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const fit = Math.max(1, Math.min(maxColumns, Math.floor(width / MIN_WIDGET_WIDTH)));
  const compact = fit === 1;
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);

  const canEdit = concept && schema && viewId && onWidgetUpdated && !editingLayout;
  const gridLayout = editingLayout || spec.widgets.some((w) => w.layout);

  const handleWidgetEdit = (widget: Widget) => {
    setEditingWidget(widget);
  };

  const handleWidgetSaved = (updatedView: SavedView) => {
    onWidgetUpdated?.(updatedView);
    setEditingWidget(null);
  };

  // Column width (in Ant's 24-unit grid) for each widget. When only one widget
  // fits, stack them full-width; otherwise respect the authored span but never
  // let a widget be narrower than 24/fit (so at most `fit` share a row).
  const columnSpan = (widget: Widget): number => {
    if (compact) return 24;
    return Math.max(Math.ceil(24 / fit), Math.min(24, widget.span ?? 24));
  };

  const widgetMenu = (widget: Widget) =>
    canEdit ? (
      <Dropdown
        menu={{
          items: [
            {
              key: 'edit',
              label: 'Edit with AI',
              onClick: () => handleWidgetEdit(widget),
            },
          ],
        }}
        trigger={['click']}
      >
        <MoreOutlined style={{ cursor: 'pointer' }} />
      </Dropdown>
    ) : undefined;

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
    <div ref={containerRef}>
      {view.error && (
        <Alert
          type="warning"
          showIcon
          title="Some data could not be loaded"
          description={view.error.message}
          style={{ marginBottom: 16 }}
        />
      )}
      {gridLayout && spec.widgets.length > 0 ? (
        <WidgetGrid
          widgets={spec.widgets}
          editing={editingLayout}
          onChange={onWidgetsChange}
          stacked={compact}
          renderWidget={(widget) => (
            <WidgetCard widget={widget} view={view} extra={widgetMenu(widget)} fill />
          )}
        />
      ) : (
        <Row gutter={compact ? [8, 8] : [16, 16]}>
          {spec.widgets.map((widget) => (
            <Col key={widget.id} span={columnSpan(widget)}>
              <WidgetCard widget={widget} view={view} extra={widgetMenu(widget)} />
            </Col>
          ))}
          {spec.widgets.length === 0 && (
            <Col span={24}>
              <Empty description="This view has no widgets yet." />
            </Col>
          )}
        </Row>
      )}

      {editingWidget && canEdit && (
        <WidgetEditorModal
          open={!!editingWidget}
          concept={concept}
          schema={schema}
          widget={editingWidget}
          viewSpec={spec}
          viewId={viewId}
          onClose={() => setEditingWidget(null)}
          onSaved={handleWidgetSaved}
        />
      )}
    </div>
  );
}

interface WidgetCardProps {
  widget: Widget;
  view: ViewData;
  extra?: React.ReactNode;
  /** Fill a fixed-size grid cell: the body scrolls and charts take its height. */
  fill?: boolean;
}

const CHART_TYPES = new Set<Widget['type']>(['line', 'bar', 'area', 'pie']);

function WidgetCard({ widget, view, extra, fill }: WidgetCardProps) {
  const [bodyRef, bodyHeight] = useElementHeight<HTMLDivElement>();

  if (!fill) {
    return (
      <Card size="small" title={widget.title} style={{ height: '100%' }} extra={extra}>
        <WidgetBody widget={widget} view={view} />
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title={widget.title}
      extra={extra}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Charts are sized to the body exactly; other widgets scroll inside it. */}
      <div
        ref={bodyRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: CHART_TYPES.has(widget.type) ? 'hidden' : 'auto',
        }}
      >
        {bodyHeight > 0 && (
          <WidgetBody widget={widget} view={view} fitHeight={Math.floor(bodyHeight)} />
        )}
      </div>
    </Card>
  );
}
