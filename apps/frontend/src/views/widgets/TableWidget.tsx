import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Column, TableWidget as TableWidgetSpec } from '@fluid/shared';
import { getPath } from '../data';
import { formatValue } from '../format';

type Row = Record<string, unknown>;

function inferColumns(rows: Row[]): Column[] {
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first)
    .filter((key) => {
      const value = first[key];
      return value == null || typeof value !== 'object';
    })
    .map((key) => ({ key, title: key }));
}

export function TableWidget({ widget, rows }: { widget: TableWidgetSpec; rows: Row[] }) {
  const specs = widget.columns && widget.columns.length > 0 ? widget.columns : inferColumns(rows);

  const columns: TableColumnsType<Row> = specs.map((col) => ({
    key: col.key,
    title: col.title,
    width: col.width,
    render: (_value: unknown, record: Row) =>
      formatValue(getPath(record, col.key), col.format, { currency: col.currency }),
  }));

  const dataSource = rows.map((row, index) => ({
    ...row,
    __rowKey: (row.id as string | undefined) ?? String(index),
  }));

  return (
    <Table<Row>
      size="small"
      rowKey="__rowKey"
      columns={columns}
      dataSource={dataSource}
      pagination={widget.pageSize ? { pageSize: widget.pageSize, size: 'small' } : false}
      scroll={{ x: 'max-content' }}
    />
  );
}
