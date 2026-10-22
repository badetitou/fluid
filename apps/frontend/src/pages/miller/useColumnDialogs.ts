import { useMemo, useReducer } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { SavedView, ViewDraft } from '../../entities/view';

/** The editor open in a column, if any: at most one at a time. */
export type ColumnDialog =
  /** `from`: the spec the conversation starts from (edits made in another editor). */
  | { kind: 'assistant'; editing?: SavedView; from?: ViewSpec }
  | { kind: 'json'; draft: ViewDraft }
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
      openJson: (draft: ViewDraft) => dispatch({ type: 'open', dialog: { kind: 'json', draft } }),
      close: () => dispatch({ type: 'close' }),
      openSettings: () => dispatch({ type: 'settings', open: true }),
      closeSettings: () => dispatch({ type: 'settings', open: false }),
    }),
    [],
  );
  return { state, ...actions };
}

export type ColumnDialogs = ReturnType<typeof useColumnDialogs>;
