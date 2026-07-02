import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Column, TableWidget as TableWidgetSpec } from '@fluid/shared';
import { getPath } from '../data';
import { formatValue } from '../format';
import { getNavigationId } from '../../navigation/linkExtractor';

type Row = Record<string, unknown>;

function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function inferColumns(rows: Row[]): Column[] {
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first)
    .filter((key) => {
      const value = first[key];
      return value == null || typeof value !== 'object';
    })
    .map((key) => ({ key, title: humanize(key) }));
}

export function TableWidget({ widget, rows }: { widget: TableWidgetSpec; rows: Row[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const specs = widget.columns && widget.columns.length > 0 ? widget.columns : inferColumns(rows);

  const columns: TableColumnsType<Row> = specs.map((col) => ({
    key: col.key,
    title: col.title ?? humanize(col.key),
    width: col.width,
    render: (_value: unknown, record: Row) => {
      const value = getPath(record, col.key);
      const formatted = formatValue(value, col.format, { currency: col.currency });

      // If the column has a linkTo config, render as a link
      if (col.linkTo) {
        const idFieldPath = col.linkTo.idField ?? 'id';
        const idValue = getNavigationId(record, idFieldPath);
        
        if (idValue) {
          // Always in Miller view: append to the current path
          const href = `${location.pathname}/${col.linkTo.concept}/${idValue}`;
          return (
            <a onClick={() => navigate(href)} style={{ cursor: 'pointer' }}>
              {formatted}
            </a>
          );
        }
      }

      return formatted;
    },
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
