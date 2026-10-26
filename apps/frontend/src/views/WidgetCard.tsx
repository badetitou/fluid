import { memo, type ReactNode } from 'react';
import { Button, Card, Tooltip } from 'antd';
import { FundProjectionScreenOutlined } from '@ant-design/icons';
import type { Widget } from '@fluid/shared';
import { useElementHeight } from '../hooks/useElementWidth';
import { PresentationFrame } from '../shared/ui';
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
  /** Shown alone on the whole window, without its card. */
  presented?: boolean;
  /** Presents the widget (its id) or stops (`undefined`); omitted, it cannot be presented. */
  onPresent?: (id: string | undefined) => void;
}

const FILL_STYLES = { body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const } };

/**
 * A widget in its card. Memoised: dragging other widgets on the grid re-renders
 * the grid on every pointer move, but not the cards whose props did not change.
 * Presented, the card's header and border go and the widget fills the window.
 */
export const WidgetCard = memo(function WidgetCard({ widget, view, renderActions, fill, presented = false, onPresent }: WidgetCardProps) {
  const [bodyRef, bodyHeight] = useElementHeight<HTMLDivElement>();
  const chart = useWidgetRenderer(widget.type)?.sizing === 'chart';
  const extra = (
    <>
      {renderActions?.(widget)}
      {onPresent && (
        <Tooltip title="Present — this widget alone, on the whole screen">
          <Button
            type="text"
            size="small"
            className={styles.present}
            aria-label="Present widget"
            icon={<FundProjectionScreenOutlined />}
            onClick={() => onPresent(widget.id)}
          />
        </Tooltip>
      )}
    </>
  );

  if (!fill && !presented) {
    return (
      <Card size="small" title={widget.title} className={styles.card} extra={extra}>
        <WidgetBody widget={widget} view={view} />
      </Card>
    );
  }

  return (
    <PresentationFrame active={presented} onExit={() => onPresent?.(undefined)} className={styles.cell}>
      <Card
        size="small"
        title={widget.title}
        extra={extra}
        variant={presented ? 'borderless' : 'outlined'}
        className={presented ? styles.presentedCard : styles.fillCard}
        styles={FILL_STYLES}
      >
        {/* Charts are sized to the body exactly; other widgets scroll inside it. */}
        <div ref={bodyRef} className={chart ? styles.chartBody : styles.scrollBody}>
          {bodyHeight > 0 && <WidgetBody widget={widget} view={view} fitHeight={Math.floor(bodyHeight)} />}
        </div>
      </Card>
    </PresentationFrame>
  );
});
