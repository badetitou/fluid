import { Card, Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface RankedCardProps<T> {
  title: string;
  hint?: string;
  rows: readonly T[];
  columns: ColumnsType<T>;
  rowKey: (row: T) => string;
}

/** A top-10 table in a card, with a short hint on how the list is built. */
export function RankedCard<T extends object>({ title, hint, rows, columns, rowKey }: RankedCardProps<T>) {
  return (
    <Card size="small" title={title} extra={hint}>
      {rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing to report" />
      ) : (
        <Table<T>
          size="small"
          dataSource={rows.slice(0, 10) as T[]}
          columns={columns}
          rowKey={rowKey}
          pagination={rows.length > 10 ? { pageSize: 10, size: 'small', total: rows.length, showSizeChanger: false } : false}
        />
      )}
    </Card>
  );
}
