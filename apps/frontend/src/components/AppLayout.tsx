import { useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { Button, ConfigProvider, Layout, Menu, Tooltip, Typography, theme } from 'antd';
import {
  ThunderboltOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SunOutlined,
  CloseOutlined,
  CompressOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import { useConnection, usePreferences, type NavbarSide } from '../store';
import { usePinning, useRootConcepts } from '../hooks/useConcepts';
import { bffClient } from '../bff/client';
import { getChrome } from '../theme';
import { ConceptIcon } from './ConceptIcon';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const location = useLocation();
  const params = useParams();
  const { token } = theme.useToken();

  const navbarSide = usePreferences((s) => s.navbarSide);
  const setNavbarSide = usePreferences((s) => s.setNavbarSide);
  const collapsed = usePreferences((s) => s.navbarCollapsed);
  const setCollapsed = usePreferences((s) => s.setNavbarCollapsed);
  const themeMode = usePreferences((s) => s.themeMode);
  const toggleThemeMode = usePreferences((s) => s.toggleThemeMode);
  const density = usePreferences((s) => s.density);
  const toggleDensity = usePreferences((s) => s.toggleDensity);
  const compact = density === 'compact';
  const chrome = getChrome(density);
  const graphqlUrl = useConnection((s) => s.graphqlUrl);

  const { concepts } = useRootConcepts();
  const { unpin } = usePinning();

  // The BFF is the shared source of truth for preferences when reachable;
  // localStorage (zustand persist) stays the offline fallback.
  useEffect(() => {
    let cancelled = false;
    bffClient
      .getPrefs()
      .then((prefs) => {
        if (cancelled) return;
        const side = prefs.navbarSide;
        if (side === 'left' || side === 'right') {
          setNavbarSide(side as NavbarSide);
        }
      })
      .catch(() => {
        /* BFF unavailable — keep the local preference */
      });
    return () => {
      cancelled = true;
    };
  }, [setNavbarSide]);

  const selectedKey = params.name ? `concept:${params.name}` : location.pathname === '/' ? 'home' : '';

  const menuItems = useMemo(
    () => [
      {
        key: 'home',
        icon: <ThunderboltOutlined />,
        label: <Link to="/">Concepts</Link>,
      },
      {
        type: 'divider' as const,
      },
      ...concepts.map((concept) => ({
        key: `concept:${concept.name}`,
        icon: <ConceptIcon name={concept.name} isRoot={concept.isRoot} />,
        label: concept.isRoot ? (
          <Link to={`/miller/${concept.name}`}>{concept.name}</Link>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to={`/miller/${concept.name}`} style={{ flex: 1, minWidth: 0 }}>
              {concept.name}
            </Link>
            <Tooltip title="Unpin">
              <CloseOutlined
                aria-label={`Unpin ${concept.name}`}
                style={{ fontSize: 10, opacity: 0.65 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  unpin(concept.name);
                }}
              />
            </Tooltip>
          </span>
        ),
      })),
    ],
    [concepts, unpin],
  );

  const sider = (
    <Sider
      width={chrome.siderWidth}
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      collapsedWidth={chrome.siderCollapsedWidth}
      theme="dark"
      style={{ overflowY: 'auto' }}
    >
      <div
        style={{
          height: compact ? chrome.headerHeight : 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          padding: collapsed ? 0 : `0 ${chrome.headerPadding}px`,
          color: '#fff',
          overflow: 'hidden',
        }}
      >
        <ThunderboltOutlined style={{ fontSize: compact ? 16 : 20 }} />
        {!collapsed && (
          <Typography.Text strong style={{ color: '#fff', fontSize: compact ? 15 : 18 }}>
            fluid
          </Typography.Text>
        )}
      </div>
      <ConfigProvider
        theme={{
          components: {
            Menu: compact
              ? { itemHeight: chrome.menuItemHeight, itemMarginBlock: 2, itemMarginInline: 4, collapsedWidth: chrome.siderCollapsedWidth }
              : {},
          },
        }}
      >
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </ConfigProvider>
    </Sider>
  );

  const toggleButton = (
    <Button
      type="text"
      aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      size={compact ? 'small' : 'middle'}
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={() => setCollapsed(!collapsed)}
    />
  );

  return (
    <Layout style={{ height: '100vh' }} hasSider>
      {navbarSide === 'left' && sider}
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: compact ? 8 : 12,
            height: chrome.headerHeight,
            lineHeight: `${chrome.headerHeight}px`,
            padding: `0 ${chrome.headerPadding}px`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            {navbarSide === 'left' && toggleButton}
            <Typography.Text type="secondary" ellipsis style={{ flex: 1, minWidth: 0 }}>
              {graphqlUrl}
            </Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 8 }}>
            <Tooltip title={compact ? 'Comfortable density' : 'Compact density'}>
              <Button
                aria-label="Toggle density"
                size={compact ? 'small' : 'middle'}
                icon={compact ? <ExpandOutlined /> : <CompressOutlined />}
                onClick={toggleDensity}
              />
            </Tooltip>
            <Tooltip title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              <Button
                aria-label="Toggle theme"
                size={compact ? 'small' : 'middle'}
                icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleThemeMode}
              />
            </Tooltip>
            <Link to="/settings">
              <Button size={compact ? 'small' : 'middle'} icon={<SettingOutlined />} />
            </Link>
            {navbarSide === 'right' && toggleButton}
          </div>
        </Header>
        <Content style={{ padding: 24, minHeight: 0, overflow: 'auto', background: token.colorBgLayout }}>
          <Outlet />
        </Content>
      </Layout>
      {navbarSide === 'right' && sider}
    </Layout>
  );
}
