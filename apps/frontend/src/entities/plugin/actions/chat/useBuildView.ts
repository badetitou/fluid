import { useCallback } from 'react';
import { isGraphConcept } from '@fluid/shared';
// Deep imports, not the `llm` index (see useChatSession).
import type { ChatTurn } from '../../../llm/chatModel';
import { buildViewSeed, canBuildView } from '../../../llm/viewSeed';
import type { PageActionColumn } from '../../pageAction';

export interface BuildViewChoice {
  /** The user's own words, added to the instruction. */
  extra?: string;
  asDashboard?: boolean;
}

/** The seed of a build: the graph concept has only dashboards, whatever the entry point. */
export const seedFor = (turns: ChatTurn[], concept: string, choice: BuildViewChoice = {}) =>
  buildViewSeed(turns, { extra: choice.extra, asDashboard: choice.asDashboard ?? isGraphConcept(concept) });

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
      openViewAssistant(seedFor(turns, column.concept, choice));
      onDone();
    },
    [openViewAssistant, turns, column.concept, onDone],
  );
  return { canBuild: openViewAssistant !== undefined && canBuildView(turns), build };
}
