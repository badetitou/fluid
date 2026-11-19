import { Card, Flex, Skeleton, Typography } from 'antd';
import type { DraftPreview as Preview } from './draftModel';

/** The view the assistant is writing, before it runs: its title and a placeholder per widget. */
export function DraftPreview({ preview }: { preview: Preview }) {
  return (
    <Flex vertical gap={8}>
      <Typography.Title level={5}>{preview.title ?? 'Drafting a view…'}</Typography.Title>
      {preview.widgets.map((w) => (
        <Card key={w.key} size="small" title={w.title ?? w.type} extra={<Typography.Text type="secondary">{w.type}</Typography.Text>}>
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </Card>
      ))}
    </Flex>
  );
}
