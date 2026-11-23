import type { ComponentType, ReactNode } from 'react';
import type { ConceptQueries } from '../../graphql/introspection';
import type { NavSectionContract } from './manifest';
import { isEnabled, navSectionsOf, settingsOf } from './model';
import type { FluidPlugin } from './types';

/** What a nav section knows when it is offered and drawn. */
export interface NavContext {
  /** The plugin's settings, as the user filled them in Settings → Plugins. */
  settings: Readonly<Record<string, string>>;
  /** The root concepts of the connected source and how to list them (empty while it loads). */
  queriesByType: ReadonlyMap<string, ConceptQueries>;
}

/** One entry of a section: an item of the antd menu, the plugin draws its label and icon. */
export interface NavItem {
  /** Unique in the sidebar: prefix it with the plugin's id. */
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** The in-app path it opens; the entry is highlighted while the page is under it. */
  to?: string;
}

/** What the page of a nav section receives: the part of the URL after `/p/<plugin>/<section>`. */
export interface NavPageProps {
  path: string;
  context: NavContext;
}

/**
 * The code half of a nav section, a group of the left sidebar. `useItems` is a React
 * hook (it may read stores and queries); the sidebar calls it once per shown section.
 * Entries open any in-app path, or the section's own `Page`, at `/p/<plugin>/<section>/…`.
 */
export interface NavSection {
  id: string;
  label: string;
  description?: string;
  /** A short symbol (an emoji) shown on its header, from the manifest. */
  icon?: string;
  /** Its icon, drawn by the plugin's code (in place of `icon`). */
  Icon?: ComponentType;
  /** Whether it is shown for the connected source (always, when left out). */
  available?: (context: NavContext) => boolean;
  useItems: (context: NavContext) => NavItem[];
  Page?: ComponentType<NavPageProps>;
}

/** A module's entry for a nav section, checked: it lists its entries. */
export function moduleNavSection(contract: NavSectionContract, entry: Record<string, unknown> | undefined): NavSection {
  const { useItems, available, Page, Icon } = entry ?? {};
  if (typeof useItems !== 'function')
    throw new Error(`The plugin module does not list the entries of the sidebar section “${contract.id}”.`);
  return {
    ...contract,
    useItems: useItems as NavSection['useItems'],
    available: typeof available === 'function' ? (available as NavSection['available']) : undefined,
    Page: typeof Page === 'function' ? (Page as NavSection['Page']) : undefined,
    Icon: typeof Icon === 'function' ? (Icon as NavSection['Icon']) : undefined,
  };
}

/** A nav section of an enabled plugin, with that plugin's settings. */
export interface ActiveNavSection {
  /** Unique among the active sections: `<pluginId>/<sectionId>`. */
  key: string;
  pluginId: string;
  section: NavSection;
  settings: Record<string, string>;
}

/** The nav sections of the enabled plugins, in plugin order, with their settings. */
export function activeNavSections(
  plugins: FluidPlugin[],
  disabled: readonly string[],
  filled: Readonly<Record<string, Record<string, string>>>,
): ActiveNavSection[] {
  return plugins
    .filter((p) => isEnabled(p, disabled))
    .flatMap((p) =>
      navSectionsOf(p).map((section) => ({
        key: `${p.manifest.id}/${section.id}`,
        pluginId: p.manifest.id,
        section,
        settings: settingsOf(p, filled),
      })),
    );
}

/** The sections shown for this source: those whose `available` says yes. */
export const shownNavSections = (
  sections: ActiveNavSection[],
  queriesByType: NavContext['queriesByType'],
): ActiveNavSection[] => sections.filter((s) => s.section.available?.({ settings: s.settings, queriesByType }) ?? true);

/** The keys of the items whose path the page is under (the highlighted entries). */
export function selectedNavKeys(pathname: string, items: readonly NavItem[]): string[] {
  return items.filter((i) => i.to && (pathname === i.to || pathname.startsWith(`${i.to}/`))).map((i) => i.key);
}

/** Pages of nav sections live under `/p/<plugin>/<section>/…`. */
export const NAV_PAGE_PREFIX = '/p';

export const navPagePath = (pluginId: string, sectionId: string, rest = ''): string =>
  `${NAV_PAGE_PREFIX}/${pluginId}/${sectionId}${rest ? `/${rest}` : ''}`;
