import { AppstoreOutlined, CodeOutlined, DashboardOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { looksLikeModel } from '../../entities/plugin/builders/modelViews';
import { rootPath } from '../../navigation/millerPath';
import type { FluidPlugin, NavSection, NavSectionPlugin } from '../../entities/plugin';
import { CodeDashboardPage } from '../../features/code-dashboard';
import { ConceptIcon } from '../../features/concept-icon';
import { navPagePath } from '../../entities/plugin';
import { useConceptMenuItems } from './useConceptMenuItems';
import { useDashboardMenuItems } from './useDashboardMenuItems';

const navPlugin = (id: string, name: string, description: string, section: NavSection): NavSectionPlugin => ({
  kind: 'navSection',
  source: { kind: 'builtin' },
  load: { status: 'ready' },
  manifest: {
    id,
    name,
    version: '1.0.0',
    kind: 'navSection',
    description,
    author: 'fluid',
    contributes: { navSections: [{ id: section.id, label: section.label, description: section.description }] },
  },
  sections: [section],
});

/** The concepts of a Model source a code analysis starts from, in this order. */
const ANALYSIS_CONCEPTS = ['Namespace', 'Class', 'Method'];

/**
 * An example of a source-aware section: shown only when the connected source is a Model
 * (Moose) project, it offers a code-quality dashboard and the entry points of a code analysis.
 */
const codeAnalysis: FluidPlugin = navPlugin(
  'fluid-nav-code-analysis',
  'Code analysis',
  'For a Model (Moose) source: shortcuts to the packages, classes and methods an analysis starts from.',
  {
    id: 'analysis',
    label: 'Code analysis',
    Icon: CodeOutlined,
    available: ({ queriesByType }) => looksLikeModel(queriesByType),
    Page: CodeDashboardPage,
    useItems: ({ queriesByType }) => [
      {
        key: 'code-analysis:dashboard',
        to: navPagePath('fluid-nav-code-analysis', 'analysis'),
        icon: <DashboardOutlined />,
        label: <Link to={navPagePath('fluid-nav-code-analysis', 'analysis')}>Dashboard</Link>,
      },
      ...ANALYSIS_CONCEPTS.filter((c) => queriesByType.has(c)).map((concept) => {
        const to = rootPath({ kind: 'column', concept });
        return {
          key: `code-analysis:${concept}`,
          to,
          icon: <ConceptIcon name={concept} isRoot />,
          label: <Link to={to}>{concept}</Link>,
        };
      }),
    ],
  },
);

/**
 * The sidebar's own groups, as plugins like any other. They live in `app/` rather
 * than with the other built-in plugins because their entries use features (icons, menus).
 */
export const BUILTIN_NAV_PLUGINS: FluidPlugin[] = [
  navPlugin('fluid-nav-concepts', 'Concepts', 'One work list per root concept of the connected source, and the pinned ones.', {
    id: 'concepts',
    label: 'Concepts',
    Icon: AppstoreOutlined,
    useItems: useConceptMenuItems,
  }),
  navPlugin('fluid-nav-dashboards', 'My dashboards', 'Your dashboards: promoted columns and whole-graph dashboards.', {
    id: 'dashboards',
    label: 'My dashboards',
    Icon: DashboardOutlined,
    useItems: useDashboardMenuItems,
  }),
  codeAnalysis,
];
