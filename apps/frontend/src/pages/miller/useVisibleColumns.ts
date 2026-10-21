import { usePreferences } from '../../store';

/** How many Miller columns to show side by side, remembered in the preferences. */
export function useVisibleColumns() {
  const count = usePreferences((s) => s.millerVisibleColumns);
  const setCount = usePreferences((s) => s.setMillerVisibleColumns);
  return [count, setCount] as const;
}
