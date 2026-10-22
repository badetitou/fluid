import { memo, type ReactNode } from 'react';
import { Card } from 'antd';
import type { Widget } from '@fluid/shared';
import { useElementHeight } from '../hooks/useElementWidth';
import type { ViewData } from './useViewData';
import { WidgetBody } from './WidgetRenderer';
import { useWidgetRenderer } from './plugin-api';
import styles from './ViewRenderer.module.css';

interface WidgetCardProps {
  widget: Widget;
  view: ViewData;
  /** Actions shown in the card header (e.g. edit with the assistant). */
  renderActions?: (widget: Widget) => ReactNode;
  /** Fill a fixed-size grid cell: the body scrolls and charts take its height. */
  fill?: boolean;
}

const FILL_STYLES = { body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const } };

/**
 * A widget in its card. Memoised: dragging other widgets on the grid re-renders
 * the grid on every pointer move, but not the cards whose props did not change.
 */
export const WidgetCard = memo(function WidgetCard({ widget, view, renderActions, fill }: WidgetCardProps) {
  const [bodyRef, bodyHeight] = useElementHeight<HTMLDivElement>();
  const extra = renderActions?.(widget);
  const chart = useWidgetRenderer(widget.type)?.sizing === 'chart';

  if (!fill) {
    return (
      <Card size="small" title={widget.title} className={styles.card} extra={extra}>
        <WidgetBody widget={widget} view={view} />
      </Card>
    );
  }

  return (
    <Card size="small" title={widget.title} extra={extra} className={styles.fillCard} styles={FILL_STYLES}>
      {/* Charts are sized to the body exactly; other widgets scroll inside it. */}
      <div ref={bodyRef} className={chart ? styles.chartBody : styles.scrollBody}>
        {bodyHeight > 0 && <WidgetBody widget={widget} view={view} fitHeight={Math.floor(bodyHeight)} />}
      </div>
    </Card>
  );
});
