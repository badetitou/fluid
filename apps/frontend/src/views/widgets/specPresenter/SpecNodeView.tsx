import { useMemo } from 'react';
import type { SpecFluidNode } from '@fluid/shared';
import { tableRows, treeRows } from './model';
import { SpecRowsTable } from './SpecRowsTable';
import { SpecDiff } from './SpecDiff';
import { SpecNotebook } from './SpecNotebook';
import { SpecSvg } from './SpecSvg';
import { SpecText } from './SpecText';
import type { SpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

interface SpecNodeViewProps {
  node: SpecFluidNode;
  interaction: SpecInteraction;
}

/** One node of a Spec-Fluid tab, drawn by kind; composites draw their children in a row or column,
 * notebooks their pages as tabs, diffs go to the code widget. */
export function SpecNodeView({ node, interaction }: SpecNodeViewProps) {
  const rows = useMemo(
    () => (node.kind === 'table' ? tableRows(node.rows) : node.kind === 'tree' ? treeRows(node.roots) : []),
    [node],
  );
  switch (node.kind) {
    case 'table':
    case 'tree':
      return <SpecRowsTable columns={node.columns} rows={rows} truncated={node.truncated} interaction={interaction} />;
    case 'svg':
      return <SpecSvg svg={node.svg} hotspots={node.refs} interaction={interaction} />;
    case 'text':
      return <SpecText text={node.text} language={node.language} highlights={node.highlights} />;
    case 'composite':
      return (
        <div className={node.direction === 'row' ? styles.row : styles.column}>
          {node.children.map((child, index) => (
            <div key={index} className={styles.part}>
              <SpecNodeView node={child} interaction={interaction} />
            </div>
          ))}
        </div>
      );
    case 'diff':
      return <SpecDiff node={node} />;
    case 'notebook':
      return (
        <SpecNotebook
          pages={node.pages}
          selected={node.selected}
          renderPage={(page) => <SpecNodeView node={page} interaction={interaction} />}
        />
      );
    case 'unsupported':
      return (
        <div className={styles.notice}>
          fluid cannot draw the Pharo presenter <code>{node.presenter}</code> yet
          {node.message ? `: ${node.message}` : '.'}
        </div>
      );
  }
}
