import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Column, TableWidget as TableWidgetSpec } from '@fluid/shared';
import { getPath } from '../data';
import { formatValue } from '../format';
import { getNavigationId } from '../../navigation/linkExtractor';
import { useNavigationHref } from '../../navigation/columnPath';
import { compareRows, filterOptions, humanize, inferColumns, matchesFilter, type Row } from './tableModel';

const EMPTY_LABEL = '(empty)';

// Header sorter and value filter of a column, as enabled by the widget.
function interactions(col: Column, rows: Row[], widget: TableWidgetSpec): Partial<TableColumnsType<Row>[number]> {
  const out: Partial<TableColumnsType<Row>[number]> = {};
  if (widget.sortable ?? true) out.sorter = compareRows(col.key);
  const options = (widget.filterable ?? true) ? filterOptions(rows, col) : null;
  if (options) {
    out.filters = options.map((value) => ({ text: value === '' ? EMPTY_LABEL : value, value }));
    out.filterSearch = true;
    out.onFilter = (value, record) => matchesFilter(record, col.key, String(value));
  }
  return out;
}

export function TableWidget({ widget, rows }: { widget: TableWidgetSpec; rows: Row[] }) {
  const navigate = useNavigate();
  const hrefFor = useNavigationHref();

  const specs = widget.columns && widget.columns.length > 0 ? widget.columns : inferColumns(rows);

  const columns: TableColumnsType<Row> = specs.map((col) => ({
    key: col.key,
    title: col.title ?? humanize(col.key),
    width: col.width,
    ...interactions(col, rows, widget),
    render: (_value: unknown, record: Row) => {
      const value = getPath(record, col.key);
      const formatted = formatValue(value, col.format, { currency: col.currency });

      // If the column has a linkTo config, render as a link
      if (col.linkTo) {
        const idFieldPath = col.linkTo.idField ?? 'id';
        const idValue = getNavigationId(record, idFieldPath);

        if (idValue) {
          const href = hrefFor(col.linkTo.concept, idValue);
          return (
            <a onClick={() => navigate(href)} style={{ cursor: 'pointer' }}>
              {formatted} <RightOutlined style={{ fontSize: 10 }} />
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
