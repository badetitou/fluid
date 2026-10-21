import { useMemo, useState } from 'react';
import { Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ScatterWidget as ScatterWidgetSpec } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { humanize } from '../../fieldHeuristics';
import { useLinkHref } from '../useCellRenderer';
import { buildLayout, buildPoints, categoriesOf, tooltipColumns, type Row } from './scatterModel';
import { ScatterAxes } from './ScatterAxes';
import { ScatterDots } from './ScatterDots';
import { ScatterLegend } from './ScatterLegend';
import { ScatterTooltip } from './ScatterTooltip';
import styles from './Scatter.module.css';

interface ScatterWidgetProps {
  widget: ScatterWidgetSpec;
  rows: Row[];
  /** Height to fill (grid layout), overriding the widget's own `height`. */
  fitHeight?: number;
}

const DEFAULT_HEIGHT = 320;
const LEGEND_HEIGHT = 24;

const fieldTitle = (field: string) => humanize(field.split('.').pop() ?? field);

/** Rows as dots on two numeric axes: hover shows a dot's label, click opens its item. */
export function ScatterWidget({ widget, rows, fitHeight }: ScatterWidgetProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [activeKey, setActiveKey] = useState<string>();
  const navigate = useNavigate();
  const hrefOf = useLinkHref();

  const points = useMemo(() => buildPoints(rows, widget), [rows, widget]);
  const hasLegend = categoriesOf(points).length > 0;
  const height = (fitHeight ?? widget.height ?? DEFAULT_HEIGHT) - (hasLegend ? LEGEND_HEIGHT : 0);
  const layout = useMemo(() => buildLayout(points, widget, Math.floor(width), height), [points, widget, width, height]);
  const hrefs = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of points) {
      const href = hrefOf(p.row, widget.linkTo);
      if (href) out.set(p.key, href);
    }
    return out;
  }, [points, hrefOf, widget.linkTo]);
  const linked = useMemo(() => new Set(hrefs.keys()), [hrefs]);

  const active = widget.tooltip === false ? undefined : layout.points.find((p) => p.key === activeKey);

  return (
    // The frame stays mounted while empty: its width is measured once, on mount.
    <div ref={ref} className={styles.frame}>
      {points.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />}
      {width > 0 && points.length > 0 && (
        <svg className={styles.svg} width={layout.width} height={layout.height} role="group" aria-label={widget.title}>
          <ScatterAxes layout={layout} xTitle={widget.xTitle ?? fieldTitle(widget.xField)} yTitle={widget.yTitle ?? fieldTitle(widget.yField)} />
          <ScatterDots
            points={layout.points}
            linked={linked}
            activeKey={activeKey}
            onActivate={setActiveKey}
            onOpen={(key) => navigate(hrefs.get(key) ?? '')}
          />
        </svg>
      )}
      {active && <ScatterTooltip point={active} columns={tooltipColumns(widget)} frameWidth={layout.width} />}
      <ScatterLegend categories={layout.categories} />
    </div>
  );
}
