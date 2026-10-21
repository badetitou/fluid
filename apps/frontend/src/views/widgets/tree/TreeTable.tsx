import { useMemo } from 'react';
import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Column, TreeWidget } from '@fluid/shared';
import { useCellRenderer } from '../useCellRenderer';
import { humanize } from '../tableModel';
import { expandedKeys, linkAt, type TreeNode } from './treeModel';

interface TreeTableProps {
  nodes: TreeNode[];
  columns: Column[];
  linkTo?: TreeWidget['linkTo'];
  expandDepth: number;
}

interface TreeRow extends Record<string, unknown> {
  __key: string;
  __depth: number;
  __children?: TreeRow[];
}

// Children live under a private field: the rows may have a `children` field of their own.
const toRow = (node: TreeNode): TreeRow => ({
  ...node.row,
  __key: node.key,
  __depth: node.depth,
  __children: node.children?.map(toRow),
});

/** A hierarchy as a table whose rows expand to show their children; the first column opens the row's object. */
export function TreeTable({ nodes, columns, linkTo, expandDepth }: TreeTableProps) {
  const renderCell = useCellRenderer();
  const dataSource = useMemo(() => nodes.map(toRow), [nodes]);
  const defaultExpanded = useMemo(() => expandedKeys(nodes, expandDepth), [nodes, expandDepth]);

  // Without links of its own, the first column opens the row's object, as a tree node would.
  const tableColumns: TableColumnsType<TreeRow> = columns.map((col, index) => ({
    key: col.key,
    title: col.title ?? humanize(col.key),
    width: col.width,
    render: (_value: unknown, record: TreeRow) =>
      renderCell(index === 0 && !col.linkTo ? { ...col, linkTo: linkAt(linkTo, record.__depth) } : col, record),
  }));

  return (
    <Table<TreeRow>
      size="small"
      rowKey="__key"
      columns={tableColumns}
      dataSource={dataSource}
      expandable={{ childrenColumnName: '__children', defaultExpandedRowKeys: defaultExpanded }}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}
