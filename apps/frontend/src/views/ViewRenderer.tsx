import { Alert, Card, Col, Empty, Row, Skeleton } from 'antd';
import type { ViewSpec } from '@fluid/shared';
import { useViewData } from './useViewData';
import { WidgetBody } from './WidgetRenderer';

/** Renders a full view spec: runs its queries and lays widgets out on a 24-column grid. */
export function ViewRenderer({ spec }: { spec: ViewSpec }) {
  const view = useViewData(spec);

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
          message="Some data could not be loaded"
          description={view.error.message}
          style={{ marginBottom: 16 }}
        />
      )}
      <Row gutter={[16, 16]}>
        {spec.widgets.map((widget) => (
          <Col key={widget.id} xs={24} lg={widget.span ?? 24}>
            <Card size="small" title={widget.title} style={{ height: '100%' }}>
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
    </>
  );
}
