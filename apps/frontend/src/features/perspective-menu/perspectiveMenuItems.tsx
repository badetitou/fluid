import type { MenuProps } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PushpinOutlined,
  RobotOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons';
import type { ViewEntry } from '../../entities/view';

/** What the "…" menu of a column can do; each action applies to the selected perspective. */
export interface PerspectiveActions {
  createWithAssistant: () => void;
  editWithAssistant: () => void;
  createJson: () => void;
  editJson: () => void;
  rename: () => void;
  setDefault: () => void;
  remove: () => void;
  openSettings: () => void;
  pin: (concept: string) => void;
}

export interface PerspectiveMenuState {
  selected: ViewEntry | undefined;
  /** False when the BFF is unreachable: nothing can be saved. */
  bffAvailable: boolean;
  concept: string;
  /** Concepts that can be pinned to the concept bar. */
  pinnable: string[];
}

type Items = NonNullable<MenuProps['items']>;

/** Menu items of a column's "…" menu: saved perspectives get the edit actions. */
export function perspectiveMenuItems(
  { selected, bffAvailable, concept, pinnable }: PerspectiveMenuState,
  actions: PerspectiveActions,
): Items {
  const saved = selected?.saved;
  const offline = !bffAvailable;
  const items: Items = [
    { key: 'assistant', icon: <RobotOutlined />, label: 'New with assistant', disabled: offline, onClick: actions.createWithAssistant },
  ];
  if (saved) {
    items.push({ key: 'assistant-edit', icon: <RobotOutlined />, label: 'Edit with assistant', disabled: offline, onClick: actions.editWithAssistant });
  }
  items.push({
    key: 'json',
    icon: <PlusOutlined />,
    label: saved ? 'New perspective (JSON)' : 'Save a copy (JSON)',
    disabled: offline,
    onClick: actions.createJson,
  });
  if (saved) {
    items.push(
      { key: 'rename', icon: <EditOutlined />, label: 'Rename', disabled: offline, onClick: actions.rename },
      { key: 'json-edit', icon: <EditOutlined />, label: 'Edit (JSON)', onClick: actions.editJson },
    );
    if (!saved.isDefault) {
      items.push({ key: 'default', icon: <StarOutlined />, label: 'Set as default', onClick: actions.setDefault });
    }
    items.push({ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Delete', onClick: actions.remove });
  }
  if (pinnable.length > 0) {
    items.push(
      { type: 'divider' },
      {
        key: 'pin',
        icon: <PushpinOutlined />,
        label: 'Pin to concept bar',
        children: pinnable.map((name) => ({
          key: `pin:${name}`,
          label: name === concept ? `${name} (this concept)` : name,
          onClick: () => actions.pin(name),
        })),
      },
    );
  }
  items.push({ type: 'divider' }, { key: 'settings', icon: <SettingOutlined />, label: 'LLM settings', onClick: actions.openSettings });
  return items;
}
