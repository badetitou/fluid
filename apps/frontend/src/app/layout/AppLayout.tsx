import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import { PageActions } from '../../features/page-actions';
import { useServerPreferences } from '../../entities/preferences/useServerPreferences';
import { usePreferences } from '../../store';
import { AppHeader } from './AppHeader';
import { AppSider } from './AppSider';
import styles from './AppLayout.module.css';

/** Application shell: the concept sider (left or right), the header, the routed page and its floating commands. */
export function AppLayout() {
  const navbarSide = usePreferences((s) => s.navbarSide);
  useServerPreferences();

  return (
    <Layout className={styles.root} hasSider>
      {navbarSide === 'left' && <AppSider />}
      <Layout className={styles.main}>
        <AppHeader />
        <Layout.Content className={styles.content}>
          <Outlet />
        </Layout.Content>
        <PageActions />
      </Layout>
      {navbarSide === 'right' && <AppSider />}
    </Layout>
  );
}
