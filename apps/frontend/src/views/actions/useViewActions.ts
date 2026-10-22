import { useCallback } from 'react';
import { App as AntdApp, Modal } from 'antd';
import { useClient } from 'urql';
import type { ViewSpec } from '@fluid/shared';
import type { ViewDataControls } from '../useViewData';
import { deletingFields, patchResults, resolveActionVariables, type ActionContext, type ActionResult } from './model';

export type RunAction = (key: string, context?: ActionContext) => Promise<ActionResult>;

/** Asks the action's `confirm` question; true when there is none or the user accepted. */
function useConfirm(): (question: string | undefined) => Promise<boolean> {
  const { modal } = AntdApp.useApp();
  return useCallback(
    (question) => {
      if (!question) return Promise.resolve(true);
      // Outside antd's <App> (tests, previews) the contextual modal is empty: fall back to the static one.
      const confirm = modal.confirm ?? Modal.confirm;
      return new Promise<boolean>((resolve) => {
        confirm({ title: question, okText: 'Confirm', onOk: () => resolve(true), onCancel: () => resolve(false) });
      });
    },
    [modal],
  );
}

/**
 * Runs the actions of a view: asks for confirmation, resolves the variables,
 * sends the mutation, patches the view's results with what it wrote, then
 * fetches the `refetch` queries again. Errors are reported, never thrown.
 */
export function useViewActions(spec: ViewSpec, view: ViewDataControls): RunAction {
  const client = useClient();
  const { message } = AntdApp.useApp();
  const confirm = useConfirm();
  const { patch, refetch } = view;

  return useCallback<RunAction>(
    async (key, context = {}) => {
      const action = spec.actions?.[key];
      if (!action) return { ok: false, error: `The view has no action "${key}".` };
      if (!(await confirm(action.confirm))) return { ok: false, error: 'Cancelled.' };

      const variables = resolveActionVariables(action.variables, context);
      const res = await client.mutation(action.mutation, variables).toPromise();
      if (res.error) {
        message.error?.(res.error.message);
        return { ok: false, error: res.error.message };
      }
      const deleted = deletingFields(action).length > 0 ? context.target : undefined;
      patch((results) => patchResults(results, res.data, deleted));
      if (action.refetch?.length) await refetch(action.refetch);
      message.success?.(action.label ? `${action.label}: applied` : 'Change applied');
      return { ok: true, data: res.data };
    },
    [spec.actions, client, message, confirm, patch, refetch],
  );
}
