import { useCallback, useMemo, useState } from 'react';
import type { BoxesWidget } from '@fluid/shared';
import { metricFields, type BoxesOverrideKey, type BoxesOverrides } from './boxesConfig';

export interface BoxesConfig {
  /** Numeric paths found in the data, plus the ones the spec already uses. */
  fields: string[];
  overrides: BoxesOverrides;
  set: (key: BoxesOverrideKey, value: string | null) => void;
  reset: () => void;
}

/** The local metric choices of one boxes widget. */
export function useBoxesConfig(widget: BoxesWidget, data: unknown): BoxesConfig {
  const [overrides, setOverrides] = useState<BoxesOverrides>({});
  const fields = useMemo(() => {
    const chosen = [widget.widthField, widget.heightField, widget.colorField].filter((f): f is string => Boolean(f));
    return [...new Set([...metricFields(data), ...chosen])].sort();
  }, [data, widget.widthField, widget.heightField, widget.colorField]);
  const set = useCallback((key: BoxesOverrideKey, value: string | null) => {
    setOverrides((current) => ({ ...current, [key]: value }) as BoxesOverrides);
  }, []);
  const reset = useCallback(() => setOverrides({}), []);
  return { fields, overrides, set, reset };
}
