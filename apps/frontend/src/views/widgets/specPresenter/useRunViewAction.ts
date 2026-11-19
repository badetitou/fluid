import { useCallback, useState } from 'react';
import { App as AntdApp } from 'antd';
import type { ViewAction } from '@fluid/shared';
import { useConfirm } from '../../actions/useViewActions';
import { confirmQuestion } from './model';
import type { OpenViewSource } from './sourceModel';
import type { SpecInteraction } from './useSpecInteraction';

interface RunViewAction {
  run: (action: ViewAction) => Promise<void>;
  /** Id of the action running, if any. */
  running?: string;
}

/**
 * Runs the actions of a view on its source: asks first when the action says
 * so, then follows the answer — `message` is shown, `ref` is opened, `refresh`
 * loads the view again. Errors are reported, never thrown.
 */
export function useRunViewAction(
  source: OpenViewSource | undefined,
  interaction: SpecInteraction,
  reload: (() => Promise<void>) | undefined,
): RunViewAction {
  const { message } = AntdApp.useApp();
  const confirm = useConfirm();
  const [running, setRunning] = useState<string>();
  const run = useCallback(
    async (action: ViewAction) => {
      if (!source || !(await confirm(confirmQuestion(action)))) return;
      setRunning(action.id);
      try {
        const result = await source.action(action.id);
        if (result.message) message.info?.(result.message);
        if (result.ref) interaction.open(result.ref);
        if (result.refresh) await reload?.();
      } catch (err) {
        message.error?.(err instanceof Error ? err.message : String(err));
      } finally {
        setRunning(undefined);
      }
    },
    [source, confirm, message, interaction, reload],
  );
  return { run, running };
}
