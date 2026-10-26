import { ThunderboltOutlined } from '@ant-design/icons';
import { FloatButton } from 'antd';
import type { PageAction } from '../../entities/plugin';
import { usePageActions, type ColumnPlace } from './usePageActions';
import styles from './PageActions.module.css';

const iconOf = ({ Icon, icon }: PageAction) =>
  Icon ? <Icon /> : icon ? <span aria-hidden>{icon}</span> : <ThunderboltOutlined />;

/**
 * The floating button of a Miller column: the commands the page action plugins
 * offer on it (run at once, or opening a panel docked under the column body).
 * Nothing when no command is offered.
 */
export function PageActions(column: ColumnPlace) {
  const { commands, trigger, open, close } = usePageActions(column);
  const Panel = open?.action.Panel;

  if (Panel && open) return <Panel context={open.context} onClose={close} />;
  if (commands.length === 0) return null;
  return (
    <FloatButton.Group
      className={styles.float}
      trigger="click"
      icon={<ThunderboltOutlined />}
      aria-label="Column actions"
    >
      {commands.map(({ key, action }) => (
        <FloatButton
          key={key}
          icon={iconOf(action)}
          tooltip={action.description ?? action.label}
          aria-label={action.label}
          onClick={() => trigger(key)}
        />
      ))}
    </FloatButton.Group>
  );
}
