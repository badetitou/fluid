import type { ReactNode } from 'react';
import { Skeleton, Tabs } from 'antd';
import type { ViewNode } from '@fluid/shared';
import { forwardBlocked, forwardKey } from './model';
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
 * from, or when it would loop or nest too deep, a link opening the object.
 */
export function SpecForward({ node, env, renderNode }: SpecForwardProps) {
  const { source, interaction, trail } = env;
  const tooDeep = forwardBlocked(trail);
  const { views, error } = useForwardedViews(tooDeep ? undefined : source, node.ref, node.view);
  const link = (
    <div className={styles.notice}>
      Shown in the views of <SpecCell cell={{ text: node.ref.id, ref: node.ref }} interaction={interaction} />
    </div>
  );
  if (!source || tooDeep) return link;
  if (error) return <div className={styles.notice}>{error}</div>;
  if (!views) return <Skeleton active />;
  const draw = (key: string) =>
    forwardBlocked(trail, forwardKey(node.ref, key)) ? (
      link
    ) : (
      <SpecForwardedView
        parent={source}
        target={node.ref}
        viewKey={key}
        trail={trail}
        interaction={interaction}
        renderNode={renderNode}
      />
    );
  if (views.length === 1) return draw(views[0].key);
  if (views.length === 0) return <div className={styles.notice}>This object has no view.</div>;
  return <Tabs size="small" items={views.map((view) => ({ key: view.key, label: view.title, children: draw(view.key) }))} />;
}
