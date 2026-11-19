import { useMemo, type ReactNode } from 'react';
import { Skeleton } from 'antd';
import type { ViewNode, ViewRef } from '@fluid/shared';
import { forwardKey } from './model';
import { useSpecEnv, type SpecEnv } from './specEnv';
import type { OpenViewSource } from './sourceModel';
import { SpecViewActions } from './SpecViewActions';
import { useLoadedView } from './useForwardedViews';
import type { SpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

interface SpecForwardedViewProps {
  /** The source of the view holding the `forward` node. */
  parent: OpenViewSource;
  target: ViewRef;
  viewKey: string;
  /** The forwarded views this one is drawn in (see `SpecEnv.trail`). */
  trail: readonly string[];
  interaction: SpecInteraction;
  /** Draws the loaded view (SpecNodeView, passed down to avoid a cyclic import). */
  renderNode: (node: ViewNode, env: SpecEnv) => ReactNode;
}

/** The view `viewKey` of another object, loaded from the same provider, with its own actions. */
export function SpecForwardedView({ parent, target, viewKey, trail, interaction, renderNode }: SpecForwardedViewProps) {
  const { id, type } = target;
  const source = useMemo(() => parent.forward({ id, type }, viewKey), [parent, id, type, viewKey]);
  const { doc, error, reload } = useLoadedView(source);
  const inner = useMemo(() => [...trail, forwardKey({ id, type }, viewKey)], [trail, id, type, viewKey]);
  const env = useSpecEnv(doc?.node, interaction, source, inner);
  if (error) return <div className={styles.notice}>{error}</div>;
  if (!doc) return <Skeleton active />;
  return (
    <>
      <SpecViewActions actions={doc.actions} source={source} interaction={interaction} reload={reload} />
      {renderNode(doc.node, env)}
    </>
  );
}
