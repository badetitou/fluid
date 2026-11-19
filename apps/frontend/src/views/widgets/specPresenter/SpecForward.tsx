import type { ReactNode } from 'react';
import { Skeleton, Tabs } from 'antd';
import type { ViewNode } from '@fluid/shared';
import type { SpecEnv } from './specEnv';
import { SpecCell } from './SpecCell';
import { SpecForwardedView } from './SpecForwardedView';
import { useForwardedViews } from './useForwardedViews';
import styles from './SpecPresenter.module.css';

interface SpecForwardProps {
  node: Extract<ViewNode, { kind: 'forward' }>;
  env: SpecEnv;
  /** Draws a forwarded view (SpecNodeView, passed down to avoid a cyclic import). */
  renderNode: (node: ViewNode, env: SpecEnv) => ReactNode;
}

/**
 * A `forward` node: the views of another object, drawn in place — the one it
 * names, else all of them as tabs by priority. Without a source to load them
 * from, a link opening the object.
 */
export function SpecForward({ node, env, renderNode }: SpecForwardProps) {
  const { source, interaction } = env;
  const { views, error } = useForwardedViews(source, node.ref, node.view);
  if (!source) {
    return (
      <div className={styles.notice}>
        Shown in the views of <SpecCell cell={{ text: node.ref.id, ref: node.ref }} interaction={interaction} />
      </div>
    );
  }
  if (error) return <div className={styles.notice}>{error}</div>;
  if (!views) return <Skeleton active />;
  const draw = (key: string) => (
    <SpecForwardedView parent={source} target={node.ref} viewKey={key} interaction={interaction} renderNode={renderNode} />
  );
  if (views.length === 1) return draw(views[0].key);
  if (views.length === 0) return <div className={styles.notice}>This object has no view.</div>;
  return <Tabs size="small" items={views.map((view) => ({ key: view.key, label: view.title, children: draw(view.key) }))} />;
}
