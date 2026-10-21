import { createContext, useContext } from 'react';
import type { Preselect } from './model';

/** The preselection of the last link followed, provided by the dashboard view. */
export const PreselectContext = createContext<Preselect | null>(null);

/** The preselection addressed to the column at `path`, if any. */
export function useColumnPreselect(path: string): Preselect | null {
  const preselect = useContext(PreselectContext);
  return preselect?.path === path ? preselect : null;
}
