import { useMemo } from 'react';
import { Tree } from 'antd';
import type { TreeDataNode } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { TreeWidget } from '@fluid/shared';
import { useLinkHref } from '../useCellRenderer';
import { expandedKeys, linkAt, type TreeNode } from './treeModel';
import styles from '../Cell.module.css';

interface TreeListProps {
  nodes: TreeNode[];
  linkTo?: TreeWidget['linkTo'];
  expandDepth: number;
}

/**
 * A hierarchy as a file explorer: folders for nodes with children, files for
 * leaves. Clicking a node that links to an object opens it in a new inspection
 * column; its caret still expands it.
 */
export function TreeList({ nodes, linkTo, expandDepth }: TreeListProps) {
  const navigate = useNavigate();
  const hrefOf = useLinkHref();

  const { treeData, hrefs } = useMemo(() => {
    const hrefs = new Map<string, string>();
    const convert = (node: TreeNode): TreeDataNode => {
      const href = hrefOf(node.row, linkAt(linkTo, node.depth));
      if (href) hrefs.set(node.key, href);
      return {
        key: node.key,
        title: href ? (
          <a className={styles.link}>
            {node.label} <RightOutlined className={styles.linkIcon} />
          </a>
        ) : (
          node.label
        ),
        isLeaf: !node.children,
        children: node.children?.map(convert),
      };
    };
    return { treeData: nodes.map(convert), hrefs };
  }, [nodes, hrefOf, linkTo]);

  const defaultExpanded = useMemo(() => expandedKeys(nodes, expandDepth), [nodes, expandDepth]);

  return (
    <Tree.DirectoryTree
      treeData={treeData}
      defaultExpandedKeys={defaultExpanded}
      expandAction={hrefs.size ? false : 'click'}
      selectable={false}
      onClick={(_, node) => {
        const href = hrefs.get(String(node.key));
        if (href) navigate(href);
      }}
      blockNode
      showLine
    />
  );
}
