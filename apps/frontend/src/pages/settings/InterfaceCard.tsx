import { Button, Card, Col, Row, Segmented, Space, Typography } from 'antd';
import { CompressOutlined, ExpandOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { usePreferences } from '../../store';
import type { Density, ThemeMode } from '../../theme';
import styles from './SettingsPage.module.css';

/** Theme, navbar side and density. */
export function InterfaceCard() {
  const themeMode = usePreferences((s) => s.themeMode);
  const setThemeMode = usePreferences((s) => s.setThemeMode);
  const navbarSide = usePreferences((s) => s.navbarSide);
  const toggleNavbarSide = usePreferences((s) => s.toggleNavbarSide);
  const density = usePreferences((s) => s.density);
  const setDensity = usePreferences((s) => s.setDensity);

  return (
    <Card title="Interface Preferences">
      <Space orientation="vertical" className={styles.full}>
        <Row gutter={16}>
          <Col span={12}>
            <Typography.Text strong>Theme</Typography.Text>
            <Segmented<ThemeMode>
              block
              className={styles.control}
              value={themeMode}
              onChange={setThemeMode}
              options={[
                { label: 'Light', value: 'light', icon: <SunOutlined /> },
                { label: 'Dark', value: 'dark', icon: <MoonOutlined /> },
              ]}
            />
          </Col>
          <Col span={12}>
            <Typography.Text strong>Navbar Position</Typography.Text>
            <Button onClick={toggleNavbarSide} block className={styles.control}>
              Current: {navbarSide}
            </Button>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Typography.Text strong>Density</Typography.Text>
            <Segmented<Density>
              block
              className={styles.control}
              value={density}
              onChange={setDensity}
              options={[
                { label: 'Comfortable', value: 'comfortable', icon: <ExpandOutlined /> },
                { label: 'Compact', value: 'compact', icon: <CompressOutlined /> },
              ]}
            />
          </Col>
        </Row>
      </Space>
    </Card>
  );
}
