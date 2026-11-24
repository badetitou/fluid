import { Button, Layout, Tooltip } from 'antd';
import {
  CompressOutlined,
  ExpandOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { SourceSwitcher } from '../../features/source-switcher';
import { usePreferences } from '../../store';
import { getChrome } from '../../theme';
import { useSettingsToggle } from './useSettingsToggle';
import styles from './AppLayout.module.css';

interface AppHeaderProps {
  /** When provided, mobile nav uses a drawer opened by this callback. */
  onOpenNav?: () => void;
}

/** Top bar: the source switcher and quick toggles (density, theme, settings, sider). */
export function AppHeader({ onOpenNav }: AppHeaderProps) {
  const navbarSide = usePreferences((s) => s.navbarSide);
  const collapsed = usePreferences((s) => s.navbarCollapsed);
  const toggleCollapsed = usePreferences((s) => s.toggleNavbarCollapsed);
  const themeMode = usePreferences((s) => s.themeMode);
  const toggleThemeMode = usePreferences((s) => s.toggleThemeMode);
  const density = usePreferences((s) => s.density);
  const toggleDensity = usePreferences((s) => s.toggleDensity);
  const settings = useSettingsToggle();
  const compact = density === 'compact';
  const chrome = getChrome(density);
  const size = compact ? 'small' : 'middle';

  const toggleSider = onOpenNav ? (
    <Button type="text" aria-label="Open navigation" size={size} icon={<MenuOutlined />} onClick={onOpenNav} />
  ) : (
    <Button
      type="text"
      aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      size={size}
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={toggleCollapsed}
    />
  );

  return (
    <Layout.Header
      className={`${styles.header} ${compact ? styles.compact : ''}`}
      style={{ height: chrome.headerHeight, lineHeight: `${chrome.headerHeight}px`, paddingInline: chrome.headerPadding }}
    >
      <div className={styles.source}>
        {navbarSide === 'left' && toggleSider}
        <SourceSwitcher size={size} />
      </div>
      <div className={styles.tools}>
        {!onOpenNav && (
          <Tooltip placement="bottomRight" title={compact ? 'Comfortable density' : 'Compact density'}>
            <Button
              aria-label="Toggle density"
              size={size}
              icon={compact ? <ExpandOutlined /> : <CompressOutlined />}
              onClick={toggleDensity}
            />
          </Tooltip>
        )}
        <Tooltip placement="bottomRight" title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <Button
            aria-label="Toggle theme"
            size={size}
            icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleThemeMode}
          />
        </Tooltip>
        <Tooltip placement="bottomRight" title={settings.open ? 'Close settings' : 'Settings'}>
          <Button
            size={size}
            aria-label={settings.open ? 'Close settings' : 'Settings'}
            aria-pressed={settings.open}
            type={settings.open ? 'primary' : 'default'}
            icon={<SettingOutlined />}
            onClick={settings.toggle}
          />
        </Tooltip>
        {navbarSide === 'right' && toggleSider}
      </div>
    </Layout.Header>
  );
}
