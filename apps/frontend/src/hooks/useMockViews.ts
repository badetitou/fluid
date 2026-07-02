/**
 * Mock hook for testing the infinite navigation feature
 * This replaces the normal useViews hook with mock data
 */

import { useState, useEffect } from 'react';
import type { ViewSpec } from '@fluid/shared';
import {
  MOCK_ACCOUNT_DETAIL_VIEW,
  MOCK_ACCOUNTS_LIST_VIEW,
  MOCK_CUSTOMER_DETAIL_VIEW,
  MOCK_CUSTOMERS_LIST_VIEW,
  MOCK_ORDER_DETAIL_VIEW,
  MOCK_ORDERS_LIST_VIEW,
} from './mockViews';

export interface ViewEntry {
  key: string;
  title: string;
  spec: ViewSpec;
  source: 'saved' | 'curated' | 'auto';
  saved?: {
    id: string;
    title: string;
    spec: ViewSpec;
    isDefault: boolean;
  };
}

export type ViewSource = ViewEntry['source'];

const MOCK_VIEWS_MAP: Record<string, ViewSpec[]> = {
  Account: [MOCK_ACCOUNTS_LIST_VIEW, MOCK_ACCOUNT_DETAIL_VIEW],
  Customer: [MOCK_CUSTOMERS_LIST_VIEW, MOCK_CUSTOMER_DETAIL_VIEW],
  Order: [MOCK_ORDERS_LIST_VIEW, MOCK_ORDER_DETAIL_VIEW],
};

/**
 * Mock version of useViews hook
 * Returns hardcoded mock views for testing the navigation feature
 */
export function useMockViews(concept: any) {
  const [entries, setEntries] = useState<ViewEntry[]>([]);
  const [defaultKey, setDefaultKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!concept?.name) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Simulate loading delay
    const timer = setTimeout(() => {
      const conceptName = concept.name;
      const specs = MOCK_VIEWS_MAP[conceptName] || [];

      const newEntries: ViewEntry[] = specs.map((spec, idx) => ({
        key: spec.id,
        title: spec.title,
        spec,
        source: idx === 0 ? 'saved' : 'auto',
        saved:
          idx === 0
            ? {
                id: spec.id,
                title: spec.title,
                spec,
                isDefault: true,
              }
            : undefined,
      }));

      setEntries(newEntries);
      setDefaultKey(newEntries[0]?.key || '');
      setLoading(false);
    }, 300); // Simulate network delay

    return () => clearTimeout(timer);
  }, [concept?.name]);

  return {
    entries,
    defaultKey,
    loading,
    bffAvailable: true,
    refetch: () => {
      setLoading(true);
      // Re-trigger the useEffect
    },
  };
}

/**
 * Configuration to enable/disable mock mode
 * Set this to true to use mock views for testing
 */
export const MOCK_MODE_ENABLED = true;
