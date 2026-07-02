import { useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Layout, Menu, Space, Tooltip, Typography, theme } from 'antd';
import {
  DisconnectOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { useConnection, usePreferences } from '../store';
import { useConcepts } from '../hooks/useConcepts';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { token } = theme.useToken();

  const navbarSide = usePreferences((s) => s.navbarSide);
  const toggleNavbarSide = usePreferences((s) => s.toggleNavbarSide);
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const disconnect = useConnection((s) => s.disconnect);

  const { concepts } = useConcepts();

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

  const handleDisconnect = () => {
    disconnect();
    navigate('/connect', { replace: true });
  };

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
          <Space>
            <Tooltip title={`Move navbar to the ${navbarSide === 'left' ? 'right' : 'left'}`}>
              <Button icon={<SwapOutlined />} onClick={toggleNavbarSide}>
                Navbar: {navbarSide}
              </Button>
            </Tooltip>
            <Button icon={<DisconnectOutlined />} onClick={handleDisconnect}>
              Disconnect
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 24, background: token.colorBgLayout }}>
          <Outlet />
        </Content>
      </Layout>
      {navbarSide === 'right' && sider}
    </Layout>
  );
}
