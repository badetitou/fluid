import { useMemo } from 'react';
import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { columnCount, compareByCell, refKey, rootKeys, rowRef, type SpecRow } from './model';
import { SpecCell } from './SpecCell';
import type { SpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

interface SpecRowsTableProps {
  columns: { title: string }[];
  /** Flat rows (table) or nested ones (tree). */
  rows: SpecRow[];
  /** The provider sent only part of the rows, and cannot page them. */
  truncated?: boolean;
  /** Rows are being loaded. */
  loading?: boolean;
  /** A row was unfolded (`key`: its item path), to load its children. */
  onExpand?: (key: string) => void;
  interaction: SpecInteraction;
}

/**
 * A list, table or tree table: sortable columns, sticky header (when columns
 * have titles), entities as links. Clicking a row naming an entity emits it on `selected`.
 */
export function SpecRowsTable({ columns, rows, truncated, loading, onExpand, interaction }: SpecRowsTableProps) {
  const tableColumns = useMemo<TableColumnsType<SpecRow>>(
    () =>
      Array.from({ length: columnCount(columns, rows) }, (_, index) => ({
        key: String(index),
        title: columns[index]?.title ?? '',
        sorter: compareByCell(index),
        render: (_value: unknown, row: SpecRow) => (
          <>
            <SpecCell cell={row.cells[index]} interaction={interaction} />
            {index === 0 && row.truncated && (
              <span className={styles.muted} title="The provider has more children than it sent">
                {' '}
                …
              </span>
            )}
          </>
        ),
      })),
    [columns, rows, interaction],
  );
  const selectedClass = (row: SpecRow) => {
    const ref = rowRef(row);
    if (!ref) return '';
    return interaction.selected === refKey(ref) ? styles.selected : styles.clickable;
  };

  return (
    <div>
      <Table<SpecRow>
        size="small"
        rowKey="key"
        columns={tableColumns}
        dataSource={rows}
        pagination={false}
        loading={loading}
        showHeader={columns.some((column) => column.title)}
        sticky
        scroll={{ x: 'max-content' }}
        expandable={{
          defaultExpandedRowKeys: rootKeys(rows),
          onExpand: (expanded, row) => {
            if (expanded && row.lazy) onExpand?.(row.key);
          },
        }}
        onRow={(row) => ({ onClick: () => interaction.select(rowRef(row)) })}
        rowClassName={selectedClass}
      />
      {truncated && <div className={styles.hint}>The provider sent only the first rows.</div>}
    </div>
  );
}
