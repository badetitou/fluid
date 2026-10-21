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

export function LineChartWidget({ widget, rows }: { widget: LineWidgetSpec; rows: Row[] }) {
  const height = widget.height ?? DEFAULT_HEIGHT;
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

export function AreaChartWidget({ widget, rows }: { widget: AreaWidgetSpec; rows: Row[] }) {
  const height = widget.height ?? DEFAULT_HEIGHT;
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

export function BarChartWidget({ widget, rows }: { widget: BarWidgetSpec; rows: Row[] }) {
  const height = widget.height ?? DEFAULT_HEIGHT;
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

export function PieChartWidget({ widget, rows }: { widget: PieWidgetSpec; rows: Row[] }) {
  const height = widget.height ?? DEFAULT_HEIGHT;
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
