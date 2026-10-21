import { useLocation } from 'react-router-dom';
import { ConfigProvider, Layout, Menu, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { selectedBarKey } from '../../entities/dashboard';
import { usePreferences } from '../../store';
import { getChrome } from '../../theme';
import { useBarItems } from './useBarItems';
import styles from './AppLayout.module.css';

/** The navigation sider: logo and the dashboard bar. */
export function AppSider() {
  const location = useLocation();
  const collapsed = usePreferences((s) => s.navbarCollapsed);
  const setCollapsed = usePreferences((s) => s.setNavbarCollapsed);
  const density = usePreferences((s) => s.density);
  const compact = density === 'compact';
  const chrome = getChrome(density);
  const items = useBarItems();
  const selectedKey = selectedBarKey(location.pathname);

  return (
    <Layout.Sider
      width={chrome.siderWidth}
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      collapsedWidth={chrome.siderCollapsedWidth}
      theme="dark"
      className={styles.sider}
    >
      <div
        className={`${styles.brand} ${collapsed ? styles.brandCollapsed : ''} ${compact ? styles.compact : ''}`}
        style={{ height: compact ? chrome.headerHeight : 56, paddingInline: collapsed ? 0 : chrome.headerPadding }}
      >
        <ThunderboltOutlined className={styles.logo} />
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
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} />
      </ConfigProvider>
    </Layout.Sider>
  );
}
