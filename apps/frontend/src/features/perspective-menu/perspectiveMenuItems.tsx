import type { MenuProps } from 'antd';
import {
  AppstoreAddOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlusOutlined,
  PushpinOutlined,
  RobotOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons';
import type { ViewEntry } from '../../entities/view';

/** What the "…" menu of a column can do; each action applies to the selected perspective. */
export interface PerspectiveActions {
  /** Opens a blank view where the editor to build it with is picked. */
  createView: () => void;
  editWithAssistant: () => void;
  createJson: () => void;
  editJson: () => void;
  setDefault: () => void;
  remove: () => void;
  openSettings: () => void;
  pin: (concept: string) => void;
  /** Adds this column, on the selected perspective, to the dashboards. */
  promote: () => void;
  /** Hides the selected perspective from the pills. */
  hide: () => void;
  /** Shows a hidden perspective again. */
  show: (key: string) => void;
}

export interface PerspectiveMenuState {
  selected: ViewEntry | undefined;
  /** False when the BFF is unreachable: nothing can be saved. */
  bffAvailable: boolean;
  concept: string;
  /** Concepts that can be pinned to the concept bar. */
  pinnable: string[];
  /** Perspectives hidden from the pills, offered to be shown again. */
  hidden: Pick<ViewEntry, 'key' | 'title'>[];
}

type Items = NonNullable<MenuProps['items']>;

/** Menu items of a column's "…" menu: saved perspectives get the edit actions, every column can be promoted. */
export function perspectiveMenuItems(
  { selected, bffAvailable, concept, pinnable, hidden }: PerspectiveMenuState,
  actions: PerspectiveActions,
): Items {
  const saved = selected?.saved;
  const offline = !bffAvailable;
  const items: Items = [
    { key: 'new', icon: <PlusOutlined />, label: 'New view', disabled: offline, onClick: actions.createView },
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
    items.push({ key: 'json-edit', icon: <EditOutlined />, label: 'Edit (JSON)', onClick: actions.editJson });
    if (!saved.isDefault) {
      items.push({ key: 'default', icon: <StarOutlined />, label: 'Set as default', onClick: actions.setDefault });
    }
    items.push({ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Delete', onClick: actions.remove });
  }
  if (selected && selected.source !== 'draft') {
    items.push({ key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Hide this view', onClick: actions.hide });
  }
  if (hidden.length > 0) {
    items.push({ type: 'divider' }, {
      key: 'hidden',
      type: 'group',
      label: 'Hidden views',
      children: hidden.map((entry) => ({
        key: `show:${entry.key}`,
        icon: <EyeOutlined />,
        label: entry.title,
        onClick: () => actions.show(entry.key),
      })),
    });
  }
  items.push(
    { type: 'divider' },
    { key: 'promote', icon: <AppstoreAddOutlined />, label: 'Promote to dashboard', onClick: actions.promote },
  );
  if (pinnable.length > 0) {
    items.push(
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
