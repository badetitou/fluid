import { Link } from 'react-router-dom';
import { AppstoreOutlined } from '@ant-design/icons';
import { selectedBarKey } from '../../entities/dashboard';
import { selectedNavKeys, type ActiveNavSection, type NavContext, type NavItem } from '../../entities/plugin';
import { FluidLogo } from '../../shared/ui';

type Queries = NavContext['queriesByType'];

/**
 * The bar: the home link, then one foldable group per shown nav section, whose
 * entries the plugins list (concepts and dashboards are plugins like any other).
 *
 * Each section's `useItems` is a hook, called in a loop over `sections`: the
 * caller (`SiderMenu`) is remounted whenever that list changes, so the hooks
 * run in the same order for as long as it lives.
 */
export function useBarItems(sections: ActiveNavSection[], queriesByType: Queries, pathname: string) {
  const lists: NavItem[][] = sections.map(({ section, settings }) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    section.useItems({ settings, queriesByType }),
  );

  const items = [
    { key: 'home', icon: <FluidLogo />, label: <Link to="/">Concepts</Link> },
    { type: 'divider' as const },
    ...sections.map(({ key, section }, i) => ({
      key: `group:${key}`,
      icon: section.Icon ? <section.Icon /> : (section.icon ?? <AppstoreOutlined />),
      label: section.label,
      children: lists[i],
    })),
  ];
  const selectedKeys = [selectedBarKey(pathname), ...selectedNavKeys(pathname, lists.flat())].filter(Boolean);
  return { items, selectedKeys };
}
