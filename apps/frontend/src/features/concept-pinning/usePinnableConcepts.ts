import { useCallback, useMemo } from 'react';
import { App as AntdApp } from 'antd';
import { usePinning, useRootConcepts } from '../../entities/concept';

/**
 * Deeper concepts are not listed in the concept bar by default: offer to pin
 * the given concepts (a column's concept and those it relates to) unless they
 * are root concepts or already pinned.
 */
export function usePinnableConcepts(names: string[]) {
  const { message } = AntdApp.useApp();
  const { queriesByType } = useRootConcepts();
  const { pinned, pin } = usePinning();

  const pinnable = useMemo(
    () => [...new Set(names)].filter((name) => !queriesByType.has(name) && !pinned.includes(name)),
    [names, queriesByType, pinned],
  );

  const pinWithFeedback = useCallback(
    (name: string) => {
      pin(name);
      message.success(`${name} pinned to the concept bar`);
    },
    [pin, message],
  );

  return { pinnable, pin: pinWithFeedback };
}
