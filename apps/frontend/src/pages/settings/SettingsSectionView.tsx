import { Flex } from 'antd';
import { InstallPluginForm, PluginKindSection } from '../../features/plugin-manager';
import { ConnectionCard } from './ConnectionCard';
import { InterfaceCard } from './InterfaceCard';
import { ListRowsCard } from './ListRowsCard';
import { LlmCard } from './LlmCard';
import type { SettingsSection } from './sections';

/** The content of one settings section. */
export function SettingsSectionView({ section }: { section: SettingsSection }) {
  if ('kind' in section) return <PluginKindSection kind={section.kind} />;
  switch (section.id) {
    case 'connection':
      return (
        <Flex vertical gap={16}>
          <ConnectionCard />
          <ListRowsCard />
        </Flex>
      );
    case 'interface':
      return <InterfaceCard />;
    case 'add-plugin':
      return <InstallPluginForm />;
    case 'assistant':
      return <LlmCard />;
  }
}
