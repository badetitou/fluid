import type { ReactNode } from 'react';
import {
  ApartmentOutlined,
  BarsOutlined,
  BlockOutlined,
  BulbOutlined,
  AreaChartOutlined,
  BarChartOutlined,
  ClusterOutlined,
  AppstoreOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  DotChartOutlined,
  EditOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  ForkOutlined,
  GoldOutlined,
  HistoryOutlined,
  HomeOutlined,
  LineChartOutlined,
  NumberOutlined,
  PieChartOutlined,
  ProfileOutlined,
  SwapOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { HeatMapOutlined } from '@ant-design/icons';
import type { CoreWidgetType } from '@fluid/shared';

export type WidgetGroup = 'Data' | 'Charts' | 'Content' | '3D' | 'AI';

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
  sankey: { label: 'Sankey', description: 'Weighted flows between a few groups, as ribbons.', icon: <ForkOutlined />, group: 'Charts' },
  boxes: { label: 'Polymetric boxes', description: 'Items as boxes sized and colored by metrics, in a hierarchy, frames or treemap.', icon: <AppstoreOutlined />, group: 'Charts' },
  classDiagram: { label: 'Class diagram', description: 'An inheritance hierarchy, as UML classes and arrows.', icon: <ClusterOutlined />, group: 'Charts' },
  matrix: { label: 'Dependency matrix', description: 'Who depends on whom, as a grid: DSM, co-usage map.', icon: <HeatMapOutlined />, group: 'Charts' },
  blueprint: { label: 'Class blueprint', description: 'The inner structure of one class: methods by layer, calls and attribute accesses.', icon: <ProfileOutlined />, group: 'Charts' },
  butterfly: { label: 'Butterfly', description: 'What depends on an element and what it depends on.', icon: <SwapOutlined />, group: 'Charts' },
  network: { label: 'Network', description: 'Items linked to each other: dependencies, call graphs…', icon: <DeploymentUnitOutlined />, group: 'Charts' },
  richtext: { label: 'Text', description: 'Markdown, plain text or a code block.', icon: <FileTextOutlined />, group: 'Content' },
  code: { label: 'Code', description: 'Source code, with diffs and annotations.', icon: <CodeOutlined />, group: 'Content' },
  form: { label: 'Form', description: 'Edit or create an item through a view action.', icon: <EditOutlined />, group: 'Data' },
  history: { label: 'History', description: 'Versions and their lineage, like a git log.', icon: <HistoryOutlined />, group: 'Content' },
  model3d: { label: '3D element', description: 'A building element (IFC) on its own, in 3D.', icon: <BlockOutlined />, group: '3D' },
  scene3d: { label: '3D scene', description: 'A whole building (IFC), some elements highlighted.', icon: <HomeOutlined />, group: '3D' },
  pyramid: { label: 'Overview pyramid', description: 'A system or package in one figure: size, coupling, inheritance.', icon: <GoldOutlined />, group: 'Charts' },
  insight: { label: 'AI analysis', description: 'An AI analyst reading the other widgets: what stands out, and what to ask next.', icon: <BulbOutlined />, group: 'AI' },
  specPresenter: { label: 'Open view', description: 'A view served by a tool in the fluid Open Views format (Pharo inspector tabs included).', icon: <FileSearchOutlined />, group: 'Content' },
};

export const WIDGET_GROUPS: WidgetGroup[] = ['Data', 'Charts', 'Content', '3D', 'AI'];
