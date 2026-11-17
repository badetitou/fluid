import { useCallback } from 'react';
// Deep imports, not the `llm` index (see useChatSession).
import type { ChatTurn } from '../../../llm/chatModel';
import { buildViewSeed, canBuildView } from '../../../llm/viewSeed';
import type { PageActionColumn } from '../../pageAction';

export interface BuildViewChoice {
  /** The user's own words, added to the instruction. */
  extra?: string;
  asDashboard?: boolean;
}

/**
 * "Build a view from this conversation": hands the talk to the page's view
 * assistant (which previews and saves it) and closes the drawer. Unavailable
 * until there is an answer, or when the page offers no assistant.
 */
export function useBuildView(turns: ChatTurn[], column: PageActionColumn, onDone: () => void) {
  const { openViewAssistant } = column;
  const build = useCallback(
    (choice: BuildViewChoice = {}) => {
      if (!openViewAssistant) return;
      openViewAssistant(buildViewSeed(turns, choice));
      onDone();
    },
    [openViewAssistant, turns, onDone],
  );
  return { canBuild: openViewAssistant !== undefined && canBuildView(turns), build };
}
