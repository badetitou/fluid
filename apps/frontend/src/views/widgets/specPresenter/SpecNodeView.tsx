import type { ViewNode } from '@fluid/shared';
import { labelLine } from './model';
import type { SpecEnv } from './specEnv';
import { SpecDiff } from './SpecDiff';
import { SpecForward } from './SpecForward';
import { SpecItems } from './SpecItems';
import { SpecNotebook } from './SpecNotebook';
import { SpecSvg } from './SpecSvg';
import { SpecText } from './SpecText';
import styles from './SpecPresenter.module.css';

interface SpecNodeViewProps {
  node: ViewNode;
  env: SpecEnv;
}

const renderNode = (node: ViewNode, env: SpecEnv) => <SpecNodeView node={node} env={env} />;

/** One node of an Open Views view, drawn by kind; composites draw their children in a row or column,
 * tabs as antd tabs, diffs with the code widget, forwards the views of another object. */
export function SpecNodeView({ node, env }: SpecNodeViewProps) {
  switch (node.kind) {
    case 'list':
    case 'columnedList':
    case 'tree':
      return <SpecItems node={node} env={env} />;
    case 'svg':
      return <SpecSvg svg={node.svg} hotspots={node.hotspots} interaction={env.interaction} />;
    case 'text':
      return <SpecText text={node.text} language={node.language} highlights={node.highlights} />;
    case 'label':
      return <span className={styles.label}>{node.text}</span>;
    case 'composite': {
      const line = labelLine(node);
      if (line !== undefined) return <div className={styles.line}>{line}</div>;
      return (
        <div className={node.direction === 'row' ? styles.row : styles.column}>
          {node.children.map((child, index) => (
            <div key={index} className={child.kind === 'label' ? styles.inline : styles.part}>
              <SpecNodeView node={child} env={env} />
            </div>
          ))}
        </div>
      );
    }
    case 'diff':
      return <SpecDiff node={node} />;
    case 'tabs':
      return <SpecNotebook tabs={node.tabs} selected={node.selected} renderTab={(tab) => renderNode(tab, env)} />;
    case 'forward':
      return <SpecForward node={node} env={env} renderNode={renderNode} />;
    case 'unsupported':
      return (
        <div className={styles.notice}>
          fluid cannot draw the view <code>{node.type}</code> yet
          {node.message ? `: ${node.message}` : '.'}
        </div>
      );
  }
}
