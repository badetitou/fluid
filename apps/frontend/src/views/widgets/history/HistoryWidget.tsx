import { useMemo, useState } from 'react';
import { Button, Empty } from 'antd';
import { InfoCircleOutlined, PictureOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { HistoryWidget as HistoryWidgetSpec } from '@fluid/shared';
import { useCellRenderer, useLinkHref } from '../useCellRenderer';
import { buildGraph } from './historyGraph';
import { buildNodes, missingLinksHint, orderChildrenFirst, type Row } from './historyModel';
import { HistoryLanes, lanesWidth } from './HistoryLanes';
import { HistoryRow } from './HistoryRow';
import { useAvatarConsent } from './useAvatarConsent';
import styles from './History.module.css';

interface HistoryWidgetProps {
  widget: HistoryWidgetSpec;
  rows: Row[];
  /** Height to fill (grid layout), overriding the widget's own `height`. */
  fitHeight?: number;
}

const ROW_HEIGHT = 32;
/** Height of a notice above the graph (avatars consent, missing links). */
const NOTICE_HEIGHT = 32;

/** A version history as a git-like graph: one line per version, lanes for branches and merges. */
export function HistoryWidget({ widget, rows, fitHeight }: HistoryWidgetProps) {
  const [activeKey, setActiveKey] = useState<string>();
  const navigate = useNavigate();
  const hrefOf = useLinkHref();
  const renderCell = useCellRenderer();

  const nodes = useMemo(() => orderChildrenFirst(buildNodes(rows, widget)), [rows, widget]);
  const graph = useMemo(() => buildGraph(nodes), [nodes]);
  const avatars = useAvatarConsent(nodes);
  const linksHint = useMemo(() => missingLinksHint(nodes, widget), [nodes, widget]);

  if (nodes.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;

  const consent = avatars.pendingHosts.length > 0;
  const height = fitHeight ?? widget.height;
  const notices = (consent ? 1 : 0) + (linksHint ? 1 : 0);
  const maxHeight = height === undefined ? undefined : height - notices * NOTICE_HEIGHT;

  return (
    <div className={styles.frame}>
      {linksHint && (
        <div role="status" className={styles.notice}>
          <InfoCircleOutlined /> {linksHint}
        </div>
      )}
      {consent && (
        <Button size="small" type="text" icon={<PictureOutlined />} className={styles.consent} onClick={avatars.allow}>
          Load avatars · {avatars.pendingHosts.join(', ')}
        </Button>
      )}
      <div className={styles.scroll} style={{ maxHeight }}>
        <div className={styles.graph} role="list" aria-label={widget.title}>
          <HistoryLanes graph={graph} rowHeight={ROW_HEIGHT} activeKey={activeKey} />
          <div style={{ paddingLeft: lanesWidth(graph.laneCount) }}>
            {graph.rows.map(({ node }) => {
              const href = hrefOf(node.row, widget.linkTo);
              return (
                <HistoryRow
                  key={node.key}
                  node={node}
                  avatarSrc={avatars.srcOf(node)}
                  extra={(widget.columns ?? []).map((col) => renderCell(col, node.row))}
                  onOpen={href ? () => navigate(href) : undefined}
                  onActivate={setActiveKey}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
