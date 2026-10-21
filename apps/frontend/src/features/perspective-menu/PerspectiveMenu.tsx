import { Button, Dropdown } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { perspectiveMenuItems, type PerspectiveActions, type PerspectiveMenuState } from './perspectiveMenuItems';

interface PerspectiveMenuProps {
  state: PerspectiveMenuState;
  actions: PerspectiveActions;
  /** Spins the trigger while a mutation runs. */
  busy: boolean;
}

/** The "…" menu of a Miller column: create, edit, rename, delete perspectives, pin concepts. */
export function PerspectiveMenu({ state, actions, busy }: PerspectiveMenuProps) {
  return (
    <Dropdown menu={{ items: perspectiveMenuItems(state, actions) }} trigger={['click']}>
      <Button type="text" size="small" aria-label="Perspective actions" icon={<MoreOutlined />} loading={busy} />
    </Dropdown>
  );
}
