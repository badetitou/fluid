import { ThunderboltOutlined } from '@ant-design/icons';
import { FloatButton } from 'antd';
import { usePageActions } from './usePageActions';
import styles from './PageActions.module.css';

/**
 * The floating button of every page: the commands the page action plugins
 * offer here (run at once, or opening a panel docked at the bottom of the page).
 * Nothing when no command is offered.
 */
export function PageActions() {
  const { commands, trigger, open, close } = usePageActions();
  const Panel = open?.action.Panel;

  return (
    <>
      {Panel && open && <Panel context={open.context} onClose={close} />}
      {commands.length > 0 && !open && (
        <FloatButton.Group
          className={styles.float}
          trigger="click"
          icon={<ThunderboltOutlined />}
          aria-label="Page actions"
        >
          {commands.map(({ key, action }) => (
            <FloatButton
              key={key}
              icon={action.icon ? <span aria-hidden>{action.icon}</span> : <ThunderboltOutlined />}
              tooltip={action.description ?? action.label}
              aria-label={action.label}
              onClick={() => trigger(key)}
            />
          ))}
        </FloatButton.Group>
      )}
    </>
  );
}
