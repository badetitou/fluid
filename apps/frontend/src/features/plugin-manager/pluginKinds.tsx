import type { ReactNode } from 'react';
import { ApiOutlined, AppstoreOutlined, BgColorsOutlined, ClusterOutlined, LayoutOutlined, MenuUnfoldOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { PluginKind } from '../../entities/plugin';
import styles from './PluginManager.module.css';

export interface PluginKindMeta {
  title: string;
  /** One sentence: what plugins of this kind bring. */
  help: string;
  icon: ReactNode;
  /** CSS class giving the kind its accent colour. */
  accent: string;
}

/** How each kind of plugin is shown: a title, an icon and an accent colour of its own. */
export const PLUGIN_KIND_META: Record<PluginKind, PluginKindMeta> = {
  widget: {
    title: 'Widgets',
    help: 'Kinds of visualisation a view is made of. Disabled widgets are no longer offered to the assistant; views using them say which plugin to enable.',
    icon: <AppstoreOutlined />,
    accent: styles.accentWidget,
  },
  viewBuilder: {
    title: 'View builders',
    help: 'Perspectives proposed in each column — curated, automatic, or asked to another backend such as Pharo — and the data sources they read.',
    icon: <LayoutOutlined />,
    accent: styles.accentViewBuilder,
  },
  sourceProvider: {
    title: 'Sources',
    help: 'GraphQL sources (a name and a URL) offered in the source switcher of the top bar, written in the plugin or listed by a backend.',
    icon: <ApiOutlined />,
    accent: styles.accentSource,
  },
  pageAction: {
    title: 'Page actions',
    help: 'Commands of the floating button of each Miller column: an effect on the page, or a panel docked under the column, such as the Pharo script.',
    icon: <ThunderboltOutlined />,
    accent: styles.accentPageAction,
  },
  graphDecorator: {
    title: 'Graph decorators',
    help: 'Declarative rules over the connected graph: tags, derived edges and constraints such as dependency cycles. Plain data, no code.',
    icon: <ClusterOutlined />,
    accent: styles.accentGraphDecorator,
  },
  navSection: {
    title: 'Sidebar sections',
    help: 'Groups of entries of the left sidebar — concepts, dashboards, or a custom page such as a code analysis, shown for the sources they fit.',
    icon: <MenuUnfoldOutlined />,
    accent: styles.accentNavSection,
  },
  theme: {
    title: 'Themes',
    help: 'Colours, fonts and shapes. Pick the active one in Interface.',
    icon: <BgColorsOutlined />,
    accent: styles.accentTheme,
  },
};
