import { useMemo } from 'react';
import { Button, Select, Spin } from 'antd';
import { AimOutlined, ExpandOutlined } from '@ant-design/icons';
import type { Network } from './networkModel';
import type { NetworkView } from './useNetworkView';
import styles from './Network.module.css';

interface NetworkToolbarProps {
  /** Every node, to find one by name (also the keyboard way to select a node). */
  network: Network;
  view: NetworkView;
  /** The layout is being computed. */
  running: boolean;
  /** Why no link is drawn, when none is. */
  hint: string | null;
}

/** Find a node, focus on the selection or show everything, and what is drawn. */
export function NetworkToolbar({ network, view, running, hint }: NetworkToolbarProps) {
  const options = useMemo(
    () => network.nodes.map((n) => ({ value: n.key, label: n.group ? `${n.label} (${n.group})` : n.label })),
    [network],
  );
  return (
    <div className={styles.toolbar}>
      <Select
        className={styles.search}
        size="small"
        showSearch
        optionFilterProp="label"
        placeholder="Find a node"
        aria-label="Find a node"
        options={options}
        value={view.selected?.key}
        onChange={(key: string) => view.select(key)}
      />
      <Button
        size="small"
        icon={<AimOutlined />}
        disabled={!view.selected || view.focused}
        onClick={() => view.setFocused(true)}
      >
        Focus on selection
      </Button>
      <Button size="small" icon={<ExpandOutlined />} disabled={!view.focused} onClick={() => view.setFocused(false)}>
        Show all
      </Button>
      {running && (
        <span role="status">
          <Spin size="small" /> Laying out…
        </span>
      )}
      <span className={styles.spacer} />
      {hint && <span className={styles.hint}>{hint}</span>}
      <span className={styles.count}>
        {view.visible.nodes.length} nodes · {view.visible.edges.length} links
      </span>
    </div>
  );
}
