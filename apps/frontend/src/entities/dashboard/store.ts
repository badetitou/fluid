import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Dashboard } from './model';

interface DashboardsState {
  /** Dashboards of the bar, keyed by GraphQL source URL. */
  byUrl: Record<string, Dashboard[]>;
  update: (url: string, change: (list: Dashboard[]) => Dashboard[]) => void;
}

// Dashboards are bookmarks into the Miller view, kept per source in the browser
// like pinned concepts; graph dashboards' views themselves live in the BFF.
export const useDashboardStore = create<DashboardsState>()(
  persist(
    (set, get) => ({
      byUrl: {},
      update: (url, change) => set({ byUrl: { ...get().byUrl, [url]: change(get().byUrl[url] ?? []) } }),
    }),
    { name: 'fluid-dashboards' },
  ),
);
