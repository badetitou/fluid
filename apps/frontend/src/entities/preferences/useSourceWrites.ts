import { useCallback } from 'react';
import { useConnection, useWritableSources } from '../../store';

/** Whether the connected source accepts writes from fluid, and how to change it. */
export function useSourceWrites(): { writable: boolean; setWritable: (writable: boolean) => void } {
  const graphqlUrl = useConnection((s) => s.graphqlUrl);
  const writable = useWritableSources((s) => (graphqlUrl ? s.byUrl[graphqlUrl] === true : false));
  const set = useWritableSources((s) => s.setWritable);
  const setWritable = useCallback(
    (on: boolean) => {
      if (graphqlUrl) set(graphqlUrl, on);
    },
    [graphqlUrl, set],
  );
  return { writable, setWritable };
}
