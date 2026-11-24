import { useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import type { ActiveNavSection, NavContext } from '../../entities/plugin';
import { useBarItems } from './useBarItems';
import { useNavbarSections } from './useNavbarSections';

interface SiderMenuProps {
  sections: ActiveNavSection[];
  queriesByType: NavContext['queriesByType'];
  collapsed: boolean;
  onNavigate?: () => void;
}

/** The sidebar menu. Remount it (`key`) when `sections` changes: it calls one hook per section. */
export function SiderMenu({ sections, queriesByType, collapsed, onNavigate }: SiderMenuProps) {
  const { pathname } = useLocation();
  const { items, selectedKeys } = useBarItems(sections, queriesByType, pathname);
  const open = useNavbarSections(collapsed);
  return (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={selectedKeys}
      items={items}
      onClick={onNavigate}
      {...open}
    />
  );
}
