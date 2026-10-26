import type { ReactNode } from 'react';
import { AppstoreOutlined, BgColorsOutlined, LayoutOutlined } from '@ant-design/icons';
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
  theme: {
    title: 'Themes',
    help: 'Colours, fonts and shapes. Pick the active one in Interface.',
    icon: <BgColorsOutlined />,
    accent: styles.accentTheme,
  },
};
