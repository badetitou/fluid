import type { PluginKind } from '../../entities/plugin';

/** The sections of the settings page, in menu order, by group. */
export const SETTINGS_SECTIONS = [
  { id: 'connection', group: 'General', label: 'Connection' },
  { id: 'interface', group: 'General', label: 'Interface' },
  { id: 'widgets', group: 'Plugins', label: 'Widgets', kind: 'widget' },
  { id: 'view-builders', group: 'Plugins', label: 'View builders', kind: 'viewBuilder' },
  { id: 'sources', group: 'Plugins', label: 'Sources', kind: 'sourceProvider' },
  { id: 'page-actions', group: 'Plugins', label: 'Page actions', kind: 'pageAction' },
  { id: 'themes', group: 'Plugins', label: 'Themes', kind: 'theme' },
  { id: 'add-plugin', group: 'Plugins', label: 'Add a plugin' },
  { id: 'assistant', group: 'Assistant', label: 'LLM provider' },
] as const satisfies readonly { id: string; group: string; label: string; kind?: PluginKind }[];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type SettingsSectionId = SettingsSection['id'];

/** The section named in the URL, else the first one. */
export function sectionOf(param: string | null): SettingsSection {
  return SETTINGS_SECTIONS.find((s) => s.id === param) ?? SETTINGS_SECTIONS[0];
}

/** The groups of the menu, in order, with their sections. */
export function sectionGroups(): { group: string; sections: SettingsSection[] }[] {
  const groups: { group: string; sections: SettingsSection[] }[] = [];
  for (const section of SETTINGS_SECTIONS) {
    const last = groups[groups.length - 1];
    if (last?.group === section.group) last.sections.push(section);
    else groups.push({ group: section.group, sections: [section] });
  }
  return groups;
}
