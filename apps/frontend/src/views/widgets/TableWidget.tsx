import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Column, TableWidget as TableWidgetSpec } from '@fluid/shared';
import { useCellRenderer } from './useCellRenderer';
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
  const renderCell = useCellRenderer();

  const specs = widget.columns && widget.columns.length > 0 ? widget.columns : inferColumns(rows);

  const columns: TableColumnsType<Row> = specs.map((col) => ({
    key: col.key,
    title: col.title ?? humanize(col.key),
    width: col.width,
    ...interactions(col, rows, widget),
    render: (_value: unknown, record: Row) => renderCell(col, record),
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
