import { useMemo, useReducer } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { ViewSeed } from '../../entities/llm';
import type { SavedView, ViewDraft } from '../../entities/view';

/** The editor open in a column, if any: at most one at a time. */
export type ColumnDialog =
  /** `from`: the spec the conversation starts from (edits made in another editor). */
  | { kind: 'assistant'; editing?: SavedView; from?: ViewSpec; seed?: ViewSeed }
  /** `asDashboard`: carried from a seeded assistant, so saving here still adds the dashboard. */
  | { kind: 'json'; draft: ViewDraft; asDashboard?: boolean }
  | null;

export interface ColumnDialogsState {
  dialog: ColumnDialog;
  /** LLM settings stack on top of the open editor instead of replacing it. */
  settingsOpen: boolean;
}

type Action =
  | { type: 'open'; dialog: Exclude<ColumnDialog, null> }
  | { type: 'close' }
  | { type: 'settings'; open: boolean };

export function columnDialogsReducer(state: ColumnDialogsState, action: Action): ColumnDialogsState {
  switch (action.type) {
    case 'open':
      return { ...state, dialog: action.dialog };
    case 'close':
      return { ...state, dialog: null };
    case 'settings':
      return { ...state, settingsOpen: action.open };
  }
}

/** Single source of truth for the dialogs of a Miller column. */
export function useColumnDialogs() {
  const [state, dispatch] = useReducer(columnDialogsReducer, { dialog: null, settingsOpen: false });
  const actions = useMemo(
    () => ({
      openAssistant: (editing?: SavedView, from?: ViewSpec) =>
        dispatch({ type: 'open', dialog: { kind: 'assistant', editing, from } }),
      /** The assistant, starting from the chat's conversation: it generates a new view at once. */
      openViewAssistant: (seed: ViewSeed) => dispatch({ type: 'open', dialog: { kind: 'assistant', seed } }),
      openJson: (draft: ViewDraft, asDashboard?: boolean) =>
        dispatch({ type: 'open', dialog: { kind: 'json', draft, asDashboard } }),
      close: () => dispatch({ type: 'close' }),
      openSettings: () => dispatch({ type: 'settings', open: true }),
      closeSettings: () => dispatch({ type: 'settings', open: false }),
    }),
    [],
  );
  return { state, ...actions };
}

export type ColumnDialogs = ReturnType<typeof useColumnDialogs>;
