import { useState } from 'react';
import { Space, Typography, Divider, Card, Button, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useConnection, usePreferences } from '../store';
import { LlmSettingsModal } from '../components/LlmSettingsModal';
import { SettingOutlined, DisconnectOutlined } from '@ant-design/icons';

export function SettingsPage() {
  const navigate = useNavigate();
  const [llmModalOpen, setLlmModalOpen] = useState(false);

  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const disconnect = useConnection((s) => s.disconnect);
  const themeMode = usePreferences((s) => s.themeMode);
  const toggleThemeMode = usePreferences((s) => s.toggleThemeMode);
  const navbarSide = usePreferences((s) => s.navbarSide);
  const setNavbarSide = usePreferences((s) => s.setNavbarSide);

  const handleDisconnect = () => {
    disconnect();
    navigate('/connect', { replace: true });
  };

  const handleToggleTheme = () => {
    toggleThemeMode();
  };

  const handleToggleNavbar = () => {
    const next = navbarSide === 'left' ? 'right' : 'left';
    setNavbarSide(next);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2}>Settings</Typography.Title>
          <Typography.Text type="secondary">
            Manage application preferences and configuration
          </Typography.Text>
        </div>

        <Divider />

        <Card title="Connection">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Typography.Text strong>GraphQL URL</Typography.Text>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 8,
                  alignItems: 'center',
                }}
              >
                <Typography.Text
                  ellipsis
                  type="secondary"
                  copyable
                  style={{ flex: 1 }}
                >
                  {graphqlUrl}
                </Typography.Text>
              </div>
            </div>
            <Button
              danger
              icon={<DisconnectOutlined />}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </Space>
        </Card>

        <Card title="Interface Preferences">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Typography.Text strong>Theme</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Button
                    onClick={handleToggleTheme}
                    block
                  >
                    Current: {themeMode}
                  </Button>
                </div>
              </Col>
              <Col span={12}>
                <Typography.Text strong>Navbar Position</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Button
                    onClick={handleToggleNavbar}
                    block
                  >
                    Current: {navbarSide}
                  </Button>
                </div>
              </Col>
            </Row>
          </Space>
        </Card>

        <Card title="Assistant (LLM) Configuration">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Configure the LLM provider and settings used for generating views and suggestions.
            </Typography.Text>
            <div>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setLlmModalOpen(true)}
                type="primary"
              >
                Configure LLM
              </Button>
            </div>
          </Space>
        </Card>

        <LlmSettingsModal open={llmModalOpen} onClose={() => setLlmModalOpen(false)} />
      </Space>
    </div>
  );
}
