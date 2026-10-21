import { useCallback } from 'react';
import { useConceptIcons, useConnection } from '../../store';

const EMPTY_ICONS: Record<string, string> = {};

/** The chosen icon key for a concept (undefined when none) and its setter, for the current source. */
export function useConceptIcon(name: string) {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const icons = useConceptIcons((s) => (graphqlUrl ? s.byUrl[graphqlUrl] : undefined)) ?? EMPTY_ICONS;
  const setIconFn = useConceptIcons((s) => s.setIcon);
  const setIcon = useCallback(
    (icon: string | null) => {
      if (graphqlUrl) setIconFn(graphqlUrl, name, icon);
    },
    [graphqlUrl, name, setIconFn],
  );
  return { icon: icons[name], setIcon };
}
