import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Drawer, Layout } from 'antd';
import { useServerPreferences } from '../../entities/preferences/useServerPreferences';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePreferences } from '../../store';
import { ReconnectBanner } from '../../features/reconnect';
import { AppHeader } from './AppHeader';
import { AppSider, SiderContent } from './AppSider';
import styles from './AppLayout.module.css';

/** Application shell: the concept sider (left or right), the header and the routed page. */
export function AppLayout() {
  const navbarSide = usePreferences((s) => s.navbarSide);
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  useServerPreferences();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  return (
    <Layout className={styles.root} hasSider={!isMobile}>
      {!isMobile && navbarSide === 'left' && <AppSider />}
      <Layout>
        <AppHeader onOpenNav={isMobile ? () => setNavOpen(true) : undefined} />
        <ReconnectBanner />
        <Layout.Content className={styles.content}>
          <Outlet />
        </Layout.Content>
      </Layout>
      {!isMobile && navbarSide === 'right' && <AppSider />}
      {isMobile && (
        <Drawer
          placement={navbarSide === 'right' ? 'right' : 'left'}
          open={navOpen}
          onClose={() => setNavOpen(false)}
          size={280}
          styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        >
          <SiderContent onNavigate={() => setNavOpen(false)} />
        </Drawer>
      )}
    </Layout>
  );
}
