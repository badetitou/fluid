import { Card, Divider, Typography } from 'antd';
import { InstallPluginForm, PluginList } from '../../features/plugin-manager';

/** The plugins (widget collections, themes): turn them on and off, add one from a URL. */
export function PluginsCard() {
  return (
    <Card title="Plugins">
      <Typography.Text type="secondary">
        Widget collections and themes. Disabled widgets are no longer offered to the assistant;
        views using them show which plugin to enable.
      </Typography.Text>
      <PluginList />
      <Divider titlePlacement="start" plain>
        Add a plugin
      </Divider>
      <InstallPluginForm />
    </Card>
  );
}
