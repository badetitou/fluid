import { useState } from 'react';
import { Alert, Card, Col, Dropdown, Empty, Row, Skeleton } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useViewData } from './useViewData';
import { WidgetBody } from './WidgetRenderer';
import { WidgetEditorModal } from '../components/WidgetEditorModal';
import type { ConceptSchemaPayload, SavedView } from '../bff/client';
import { useElementWidth } from '../hooks/useElementWidth';

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
}

/**
 * Renders a full view spec: runs its queries and lays widgets out on a 24-column
 * grid. How many widgets fit on a row follows the width actually available to
 * the renderer (not the viewport), so a lone Miller column uses the whole screen
 * while side-by-side columns stack their widgets.
 */
export function ViewRenderer({ spec, concept, schema, viewId, onWidgetUpdated, maxColumns = 3 }: ViewRendererProps) {
  const view = useViewData(spec);
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const fit = Math.max(1, Math.min(maxColumns, Math.floor(width / MIN_WIDGET_WIDTH)));
  const compact = fit === 1;
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);

  const canEdit = concept && schema && viewId && onWidgetUpdated;

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
      <Row gutter={compact ? [8, 8] : [16, 16]}>
        {spec.widgets.map((widget) => (
          <Col key={widget.id} span={columnSpan(widget)}>
            <Card
              size="small"
              title={widget.title}
              style={{ height: '100%' }}
              extra={
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
                ) : undefined
              }
            >
              <WidgetBody widget={widget} view={view} />
            </Card>
          </Col>
        ))}
        {spec.widgets.length === 0 && (
          <Col span={24}>
            <Empty description="This view has no widgets yet." />
          </Col>
        )}
      </Row>

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
