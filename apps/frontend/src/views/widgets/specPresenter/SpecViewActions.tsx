import { Button } from 'antd';
import type { ViewAction } from '@fluid/shared';
import type { OpenViewSource } from './sourceModel';
import { useRunViewAction } from './useRunViewAction';
import type { SpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

interface SpecViewActionsProps {
  actions: ViewAction[];
  source?: OpenViewSource;
  interaction: SpecInteraction;
  /** Loads the view again, for the actions answering `refresh`. */
  reload?: () => Promise<void>;
}

/** The actions a view offers, as buttons above it; disabled when there is no source to run them on. */
export function SpecViewActions({ actions, source, interaction, reload }: SpecViewActionsProps) {
  const { run, running } = useRunViewAction(source, interaction, reload);
  if (actions.length === 0) return null;
  return (
    <div className={styles.actions}>
      {actions.map((action) => (
        <Button
          key={action.id}
          size="small"
          loading={running === action.id}
          disabled={!source || (running !== undefined && running !== action.id)}
          title={source ? undefined : 'No data source to run this action on.'}
          onClick={() => void run(action)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
