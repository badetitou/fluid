import type { SankeyLayout } from './sankeyLayout';
import { linkLabel } from './SankeyLinks';
import { formatFlow } from './sankeyModel';
import type { SankeyItem } from './useSankeySelection';
import styles from './Sankey.module.css';

interface SankeyTooltipProps {
  item: SankeyItem;
  layout: SankeyLayout;
}

const OFFSET = 10;

/** The card next to the hovered node or ribbon: "A → B: v", or the node and its total flow. */
export function SankeyTooltip({ item, layout }: SankeyTooltipProps) {
  const link = item.kind === 'link' ? layout.links.find((l) => l.key === item.key) : undefined;
  const node = item.kind === 'node' ? layout.nodes.find((n) => n.key === item.key) : undefined;
  const at = link ? { x: link.mx, y: link.my } : node ? { x: (node.x0 + node.x1) / 2, y: (node.y0 + node.y1) / 2 } : undefined;
  if (!at) return null;
  const onRight = at.x < layout.width / 2;
  const position = onRight ? { left: at.x + OFFSET, top: at.y } : { right: layout.width - at.x + OFFSET, top: at.y };
  return (
    <div className={styles.tooltip} style={position} role="tooltip">
      {link ? linkLabel(link) : node && `${node.key}: ${formatFlow(node.value)} (${node.rows.length} rows)`}
      {link?.back && <div className={styles.tooltipNote}>Goes back: closes a cycle</div>}
    </div>
  );
}
