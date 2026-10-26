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
  /** Pharo sent only part of the rows. */
  truncated?: boolean;
  interaction: SpecInteraction;
}

/**
 * A Spec table or tree table: sortable columns, sticky header, entities as
 * links. Clicking a row naming an entity emits it on `selected`.
 */
export function SpecRowsTable({ columns, rows, truncated, interaction }: SpecRowsTableProps) {
  const tableColumns = useMemo<TableColumnsType<SpecRow>>(
    () =>
      Array.from({ length: columnCount(columns, rows) }, (_, index) => ({
        key: String(index),
        title: columns[index]?.title ?? '',
        sorter: compareByCell(index),
        render: (_value: unknown, row: SpecRow) => (
          <>
            <SpecCell cell={row.cells[index]} interaction={interaction} />
            {index === 0 && row.hasMore && (
              <span className={styles.muted} title="Pharo has more children than it sent">
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
        sticky
        scroll={{ x: 'max-content' }}
        expandable={{ defaultExpandedRowKeys: rootKeys(rows) }}
        onRow={(row) => ({ onClick: () => interaction.select(rowRef(row)) })}
        rowClassName={selectedClass}
      />
      {truncated && <div className={styles.hint}>Pharo sent only the first rows.</div>}
    </div>
  );
}
