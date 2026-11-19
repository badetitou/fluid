import type { DraftPreview } from './draftModel';
import type { ParsedToolResult, ViewPayload } from './toolResult';

// What the viewer shows, as a pure reducer over what the host sends.

export interface ViewerState {
  /** The last good view; a later failing result does not replace it. */
  view?: ViewPayload;
  /** What went wrong last, until a good result arrives. */
  error?: string;
  /** The draft the assistant is writing, until its result arrives. */
  preview?: DraftPreview;
  /** Set once the shown draft is saved in fluid. */
  savedTitle?: string;
}

export type ViewerAction =
  | { type: 'input'; preview: DraftPreview }
  | { type: 'result'; parsed: ParsedToolResult }
  | { type: 'saved'; viewId: string; title: string }
  | { type: 'failed'; message: string };

export function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'input':
      return { ...state, preview: action.preview };
    case 'result':
      return action.parsed.kind === 'view'
        ? { view: action.parsed.payload }
        : { ...state, error: action.parsed.message, preview: undefined };
    case 'saved':
      // The draft is now a saved view: it can load more rows, and it cannot be saved twice.
      if (!state.view) return state;
      return { ...state, view: { ...state.view, viewId: action.viewId, draft: undefined }, savedTitle: action.title, error: undefined };
    case 'failed':
      return { ...state, error: action.message };
  }
}
