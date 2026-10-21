import { Empty } from 'antd';
import { Area, Column, Line, Pie } from '@ant-design/plots';
import type {
  AreaWidget as AreaWidgetSpec,
  BarWidget as BarWidgetSpec,
  LineWidget as LineWidgetSpec,
  PieWidget as PieWidgetSpec,
} from '@fluid/shared';
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
    <Line
      data={rows}
      xField={widget.xField}
      yField={widget.yField}
      colorField={widget.colorField}
      height={height}
      theme={chartTheme}
      autoFit
    />
  );
}

export function AreaChartWidget({ widget, rows, fitHeight }: ChartProps<AreaWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const chartTheme = useChartTheme();
  if (rows.length === 0) return <ChartEmpty height={height} />;
  return (
    <Area
      data={rows}
      xField={widget.xField}
      yField={widget.yField}
      colorField={widget.colorField}
      height={height}
      theme={chartTheme}
      autoFit
    />
  );
}

export function BarChartWidget({ widget, rows, fitHeight }: ChartProps<BarWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const chartTheme = useChartTheme();
  if (rows.length === 0) return <ChartEmpty height={height} />;
  return (
    <Column
      data={rows}
      xField={widget.xField}
      yField={widget.yField}
      colorField={widget.colorField}
      height={height}
      theme={chartTheme}
      autoFit
    />
  );
}

export function PieChartWidget({ widget, rows, fitHeight }: ChartProps<PieWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const chartTheme = useChartTheme();
  if (rows.length === 0) return <ChartEmpty height={height} />;
  return (
    <Pie
      data={rows}
      angleField={widget.angleField}
      colorField={widget.colorField}
      height={height}
      theme={chartTheme}
      autoFit
    />
  );
}
