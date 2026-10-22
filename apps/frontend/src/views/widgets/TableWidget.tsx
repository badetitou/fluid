import { useState } from 'react';
import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Column, TableWidget as TableWidgetSpec } from '@fluid/shared';
import type { InvokeAction } from '../plugin-api';
import { RowActionButtons } from './RowActionButtons';
import { useCellRenderer } from './useCellRenderer';
import styles from './TableWidget.module.css';
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

interface TableWidgetProps {
  widget: TableWidgetSpec;
  rows: Row[];
  /** Clicking a row emits it on the `selected` output. */
  emit?: (port: string, value: unknown) => void;
  /** Runs the row actions; without it (read-only source) they are not shown. */
  invoke?: InvokeAction;
}

export function TableWidget({ widget, rows, emit, invoke }: TableWidgetProps) {
  const renderCell = useCellRenderer();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const specs = widget.columns && widget.columns.length > 0 ? widget.columns : inferColumns(rows);

  const columns: TableColumnsType<Row> = specs.map((col) => ({
    key: col.key,
    title: col.title ?? humanize(col.key),
    width: col.width,
    ...interactions(col, rows, widget),
    render: (_value: unknown, record: Row) => renderCell(col, record),
  }));
  if (invoke && widget.rowActions?.length) {
    const actions = widget.rowActions;
    columns.push({
      key: '__actions',
      title: '',
      fixed: 'right',
      render: (_value: unknown, record: Row) => {
        const { __rowKey: _key, ...row } = record;
        return <RowActionButtons actions={actions} row={row} invoke={invoke} />;
      },
    });
  }

  const dataSource = rows.map((row, index) => ({
    ...row,
    __rowKey: (row.id as string | undefined) ?? String(index),
  }));
  const select = (record: Row) => {
    const index = dataSource.findIndex((r) => r.__rowKey === record.__rowKey);
    setSelectedKey(String(record.__rowKey));
    emit?.('selected', rows[index] ?? record);
  };

  return (
    <Table<Row>
      size="small"
      rowKey="__rowKey"
      columns={columns}
      dataSource={dataSource}
      pagination={widget.pageSize ? { pageSize: widget.pageSize, size: 'small' } : false}
      scroll={{ x: 'max-content' }}
      onRow={emit ? (record) => ({ onClick: () => select(record) }) : undefined}
      rowClassName={(record) => (String(record.__rowKey) === selectedKey ? styles.selected : styles.row)}
    />
  );
}
