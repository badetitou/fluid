import type { ReactNode } from 'react';
import {
  ApartmentOutlined,
  BarsOutlined,
  AreaChartOutlined,
  BarChartOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  DotChartOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LineChartOutlined,
  NumberOutlined,
  PieChartOutlined,
  ProfileOutlined,
  TableOutlined,
} from '@ant-design/icons';
import type { CoreWidgetType } from '@fluid/shared';

export type WidgetGroup = 'Data' | 'Charts' | 'Content';

/** How a widget type is presented in the catalog of the layout editor. */
export interface WidgetInfo {
  label: string;
  description: string;
  icon: ReactNode;
  group: WidgetGroup;
}

/** Catalog entry of every widget type. Typed exhaustively, like the renderers. */
export const WIDGET_INFO: { [T in CoreWidgetType]: WidgetInfo } = {
  table: { label: 'Table', description: 'Rows and columns, sortable and filterable.', icon: <TableOutlined />, group: 'Data' },
  statistic: { label: 'Statistic', description: 'One key figure: a count, a sum, an average…', icon: <NumberOutlined />, group: 'Data' },
  descriptions: { label: 'Details', description: 'The fields of a single item, as label / value pairs.', icon: <ProfileOutlined />, group: 'Data' },
  accordion: { label: 'Accordion', description: 'One folding panel per item, with its details inside.', icon: <BarsOutlined />, group: 'Data' },
  tree: { label: 'Tree', description: 'A hierarchy, as a file explorer or expandable table.', icon: <ApartmentOutlined />, group: 'Data' },
  line: { label: 'Line chart', description: 'A value over an ordered axis, such as time.', icon: <LineChartOutlined />, group: 'Charts' },
  bar: { label: 'Bar chart', description: 'Values compared across categories.', icon: <BarChartOutlined />, group: 'Charts' },
  area: { label: 'Area chart', description: 'A line chart with filled volume.', icon: <AreaChartOutlined />, group: 'Charts' },
  pie: { label: 'Pie chart', description: 'Shares of a whole.', icon: <PieChartOutlined />, group: 'Charts' },
  scatter: { label: 'Scatter plot', description: 'Rows as dots on two numeric axes.', icon: <DotChartOutlined />, group: 'Charts' },
  network: { label: 'Network', description: 'Items linked to each other: dependencies, call graphs…', icon: <DeploymentUnitOutlined />, group: 'Charts' },
  richtext: { label: 'Text', description: 'Markdown, plain text or a code block.', icon: <FileTextOutlined />, group: 'Content' },
  code: { label: 'Code', description: 'Source code, with diffs and annotations.', icon: <CodeOutlined />, group: 'Content' },
  history: { label: 'History', description: 'Versions and their lineage, like a git log.', icon: <HistoryOutlined />, group: 'Content' },
};

export const WIDGET_GROUPS: WidgetGroup[] = ['Data', 'Charts', 'Content'];
