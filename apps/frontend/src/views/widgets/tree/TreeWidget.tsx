import { useMemo } from 'react';
import { Empty } from 'antd';
import type { TreeWidget as TreeWidgetSpec } from '@fluid/shared';
import { buildTree } from './treeModel';
import { TreeList } from './TreeList';
import { TreeTable } from './TreeTable';

/** A hierarchy, as a file-explorer tree or, when the widget has columns, as an expandable table. */
export function TreeWidget({ widget, data }: { widget: TreeWidgetSpec; data: unknown }) {
  const nodes = useMemo(() => buildTree(data, widget), [data, widget]);
  const expandDepth = widget.expandDepth ?? 1;

  if (nodes.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;
  if (widget.columns?.length) return <TreeTable nodes={nodes} columns={widget.columns} linkTo={widget.linkTo} expandDepth={expandDepth} />;
  return <TreeList nodes={nodes} linkTo={widget.linkTo} expandDepth={expandDepth} />;
}
