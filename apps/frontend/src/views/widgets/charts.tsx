import type { ReactNode } from 'react';
import { Empty } from 'antd';
import { Area, Column, Line, Pie } from '@ant-design/plots';
import type {
  AreaWidget as AreaWidgetSpec,
  BarWidget as BarWidgetSpec,
  LineWidget as LineWidgetSpec,
  PieWidget as PieWidgetSpec,
} from '@fluid/shared';
import { useElementWidth } from '../../hooks/useElementWidth';
import { usePreferences } from '../../store';

type Row = Record<string, unknown>;

const DEFAULT_HEIGHT = 260;

interface ChartProps<W> {
  widget: W;
  rows: Row[];
  /** Height the chart must fill (grid layout), overriding the widget's own `height`. */
  fitHeight?: number;
}

/** G2 theme matching the app's light/dark mode. */
function useChartTheme() {
  return usePreferences((s) => (s.themeMode === 'dark' ? 'classicDark' : 'classic'));
}

/**
 * Sizes a chart to its container. G2's `autoFit` only listens to window resizes, so a
 * chart whose column narrows (e.g. a Miller navigation opening a new column) would keep
 * its old width and overflow; we measure the container and pass the width explicitly.
 */
function ChartFrame({ height, children }: { height: number; children: (width: number) => ReactNode }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0, height, overflow: 'hidden' }}>
      {width > 0 && children(Math.floor(width))}
    </div>
  );
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
    </div>
  );
}

export function LineChartWidget({ widget, rows, fitHeight }: ChartProps<LineWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const chartTheme = useChartTheme();
  if (rows.length === 0) return <ChartEmpty height={height} />;
  return (
    <ChartFrame height={height}>
      {(width) => (
        <Line
          data={rows}
          xField={widget.xField}
          yField={widget.yField}
          colorField={widget.colorField}
          height={height}
          theme={chartTheme}
          width={width}
          autoFit={false}
        />
      )}
    </ChartFrame>
  );
}

export function AreaChartWidget({ widget, rows, fitHeight }: ChartProps<AreaWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const chartTheme = useChartTheme();
  if (rows.length === 0) return <ChartEmpty height={height} />;
  return (
    <ChartFrame height={height}>
      {(width) => (
        <Area
          data={rows}
          xField={widget.xField}
          yField={widget.yField}
          colorField={widget.colorField}
          height={height}
          theme={chartTheme}
          width={width}
          autoFit={false}
        />
      )}
    </ChartFrame>
  );
}

export function BarChartWidget({ widget, rows, fitHeight }: ChartProps<BarWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const chartTheme = useChartTheme();
  if (rows.length === 0) return <ChartEmpty height={height} />;
  return (
    <ChartFrame height={height}>
      {(width) => (
        <Column
          data={rows}
          xField={widget.xField}
          yField={widget.yField}
          colorField={widget.colorField}
          height={height}
          theme={chartTheme}
          width={width}
          autoFit={false}
        />
      )}
    </ChartFrame>
  );
}

export function PieChartWidget({ widget, rows, fitHeight }: ChartProps<PieWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const chartTheme = useChartTheme();
  if (rows.length === 0) return <ChartEmpty height={height} />;
  return (
    <ChartFrame height={height}>
      {(width) => (
        <Pie
          data={rows}
          angleField={widget.angleField}
          colorField={widget.colorField}
          height={height}
          theme={chartTheme}
          width={width}
          autoFit={false}
        />
      )}
    </ChartFrame>
  );
}
