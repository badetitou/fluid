import { useParams } from 'react-router-dom';
import { Empty } from 'antd';
import { useRootConcepts } from '../../entities/concept';
import { useActiveNavSections } from '../../entities/plugin';

/** The page of a nav section (`/p/<plugin>/<section>/…`): drawn by the plugin that contributes it. */
export function PluginPage() {
  const { pluginId, sectionId, '*': path = '' } = useParams();
  const { queriesByType } = useRootConcepts();
  const active = useActiveNavSections().find((s) => s.pluginId === pluginId && s.section.id === sectionId);
  const Page = active?.section.Page;
  if (!active || !Page) return <Empty description="This page is not provided by an enabled plugin." />;
  return <Page path={path} context={{ settings: active.settings, queriesByType }} />;
}
