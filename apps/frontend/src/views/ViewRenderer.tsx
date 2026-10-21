import { useState } from 'react';
import { Alert, Card, Col, Dropdown, Empty, Row, Skeleton } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { ViewSpec, Widget } from '@fluid/shared';
import { useViewData } from './useViewData';
import { WidgetBody } from './WidgetRenderer';
import { WidgetEditorModal } from '../components/WidgetEditorModal';
import type { ConceptSchemaPayload, SavedView } from '../bff/client';

interface ViewRendererProps {
  spec: ViewSpec;
  concept?: string;
  schema?: ConceptSchemaPayload;
  viewId?: string;
  onWidgetUpdated?: (updatedView: SavedView) => void;
  /** Stack every widget full-width with tight spacing, for narrow Miller columns. */
  compact?: boolean;
  /** When set (and not compact), cap the grid at this many columns per row. */
  maxColumns?: number;
}

/** Renders a full view spec: runs its queries and lays widgets out on a 24-column grid. */
export function ViewRenderer({ spec, concept, schema, viewId, onWidgetUpdated, compact, maxColumns }: ViewRendererProps) {
  const view = useViewData(spec);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);

  const canEdit = concept && schema && viewId && onWidgetUpdated;

  const handleWidgetEdit = (widget: Widget) => {
    setEditingWidget(widget);
  };

  const handleWidgetSaved = (updatedView: SavedView) => {
    onWidgetUpdated?.(updatedView);
    setEditingWidget(null);
  };

  // Column width (in Ant's 24-unit grid) for each widget. Compact stacks every
  // widget full-width; otherwise respect the authored span, but when maxColumns
  // is set never let a widget be narrower than 24/maxColumns (so at most that
  // many fit on a row).
  const columnSpan = (widget: Widget): number => {
    if (compact) return 24;
    const span = Math.min(24, widget.span ?? 24);
    if (maxColumns && maxColumns > 0) {
      return Math.max(Math.ceil(24 / maxColumns), span);
    }
    return span;
  };

  if (view.fetching) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  return (
    <>
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
          <Col key={widget.id} xs={24} lg={columnSpan(widget)}>
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
    </>
  );
}
