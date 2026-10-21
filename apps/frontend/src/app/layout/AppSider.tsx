import { useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, Typography } from 'antd';
import { selectedBarKey } from '../../entities/dashboard';
import { FluidLogo } from '../../shared/ui';
import { usePreferences } from '../../store';
import { getChrome } from '../../theme';
import { useBarItems } from './useBarItems';
import { useNavbarSections } from './useNavbarSections';
import styles from './AppLayout.module.css';

/** The navigation sider: logo (over the brand gradient bar) and the dashboard bar. */
export function AppSider() {
  const location = useLocation();
  const collapsed = usePreferences((s) => s.navbarCollapsed);
  const setCollapsed = usePreferences((s) => s.setNavbarCollapsed);
  const density = usePreferences((s) => s.density);
  const compact = density === 'compact';
  const chrome = getChrome(density);
  const items = useBarItems();
  const selectedKey = selectedBarKey(location.pathname);
  const sections = useNavbarSections(collapsed);
  const navbarSide = usePreferences((s) => s.navbarSide);

  return (
    <Layout.Sider
      width={chrome.siderWidth}
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      collapsedWidth={chrome.siderCollapsedWidth}
      theme="light"
      className={`${styles.sider} ${navbarSide === 'right' ? styles.siderRight : ''}`}
    >
      <div
        className={`${styles.brand} ${collapsed ? styles.brandCollapsed : ''} ${compact ? styles.compact : ''}`}
        style={{ height: chrome.headerHeight, paddingInline: collapsed ? 0 : chrome.headerPadding }}
      >
        <FluidLogo className={styles.logo} />
        {!collapsed && (
          <Typography.Text strong className={styles.brandName}>
            fluid
          </Typography.Text>
        )}
      </div>
      <ConfigProvider
        theme={{
          components: {
            Menu: compact
              ? {
                  itemHeight: chrome.menuItemHeight,
                  itemMarginBlock: 2,
                  itemMarginInline: 4,
                  collapsedWidth: chrome.siderCollapsedWidth,
                }
              : {},
          },
        }}
      >
        <Menu theme="light" mode="inline" selectedKeys={[selectedKey]} items={items} {...sections} />
      </ConfigProvider>
    </Layout.Sider>
  );
}
