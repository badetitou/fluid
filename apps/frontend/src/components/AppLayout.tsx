import { useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { Button, Layout, Menu, Typography, theme } from 'antd';
import {
  ThunderboltOutlined,
  TableOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useConnection, usePreferences, type NavbarSide } from '../store';
import { useConcepts } from '../hooks/useConcepts';
import { bffClient } from '../bff/client';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const location = useLocation();
  const params = useParams();
  const { token } = theme.useToken();

  const navbarSide = usePreferences((s) => s.navbarSide);
  const setNavbarSide = usePreferences((s) => s.setNavbarSide);
  const graphqlUrl = useConnection((s) => s.graphqlUrl);

  const { concepts } = useConcepts();

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
        icon: <TableOutlined />,
        label: <Link to={`/concept/${concept.name}`}>{concept.name}</Link>,
      })),
    ],
    [concepts],
  );

  const sider = (
    <Sider width={240} theme="dark" breakpoint="lg" collapsedWidth={0}>
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 20px',
          color: '#fff',
        }}
      >
        <ThunderboltOutlined style={{ fontSize: 20 }} />
        <Typography.Text strong style={{ color: '#fff', fontSize: 18 }}>
          fluid
        </Typography.Text>
      </div>
      <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
    </Sider>
  );

  return (
    <Layout style={{ minHeight: '100vh' }} hasSider>
      {navbarSide === 'left' && sider}
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Typography.Text type="secondary" ellipsis style={{ maxWidth: '50%' }}>
            {graphqlUrl}
          </Typography.Text>
          <Link to="/settings">
            <Button icon={<SettingOutlined />} />
          </Link>
        </Header>
        <Content style={{ padding: 24, background: token.colorBgLayout }}>
          <Outlet />
        </Content>
      </Layout>
      {navbarSide === 'right' && sider}
    </Layout>
  );
}
