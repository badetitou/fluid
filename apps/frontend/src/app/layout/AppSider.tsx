import { ConfigProvider, Layout, Typography } from 'antd';
import { useShownNavSections } from './useShownNavSections';
import { FluidLogo } from '../../shared/ui';
import { usePreferences } from '../../store';
import { getChrome } from '../../theme';
import { SiderMenu } from './SiderMenu';
import { SiderResizeHandle } from './SiderResizeHandle';
import styles from './AppLayout.module.css';

interface SiderContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** Navigation content shared by the desktop sider and the mobile drawer. */
export function SiderContent({ collapsed = false, onNavigate }: SiderContentProps) {
  const density = usePreferences((s) => s.density);
  const compact = density === 'compact';
  const chrome = getChrome(density);
  const { sections, queriesByType } = useShownNavSections();

  return (
    <>
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
        <SiderMenu
          key={sections.map((s) => s.key).join()}
          sections={sections}
          queriesByType={queriesByType}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </ConfigProvider>
    </>
  );
}

/** The navigation sider: logo (over the brand gradient bar) and the dashboard bar. */
export function AppSider() {
  const collapsed = usePreferences((s) => s.navbarCollapsed);
  const setCollapsed = usePreferences((s) => s.setNavbarCollapsed);
  const chrome = getChrome(usePreferences((s) => s.density));
  const navbarSide = usePreferences((s) => s.navbarSide);
  const width = usePreferences((s) => s.navbarWidth) ?? chrome.siderWidth;

  return (
    <Layout.Sider
      width={width}
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      collapsedWidth={chrome.siderCollapsedWidth}
      theme="light"
      className={`${styles.sider} ${navbarSide === 'right' ? styles.siderRight : ''}`}
    >
      <SiderContent collapsed={collapsed} />
      {!collapsed && <SiderResizeHandle width={width} side={navbarSide} />}
    </Layout.Sider>
  );
}
