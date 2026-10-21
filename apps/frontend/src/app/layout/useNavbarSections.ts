import { usePreferences } from '../../store';

/**
 * Which navbar sections are unfolded, remembered across sessions. While the
 * sider is collapsed the menu shows sections as popups and manages them itself,
 * so the remembered state is neither applied nor overwritten.
 */
export function useNavbarSections(collapsed: boolean) {
  const openKeys = usePreferences((s) => s.navbarOpenSections);
  const setOpenKeys = usePreferences((s) => s.setNavbarOpenSections);

  return {
    openKeys: collapsed ? undefined : openKeys,
    onOpenChange: (keys: string[]) => {
      if (!collapsed) setOpenKeys(keys);
    },
  };
}
