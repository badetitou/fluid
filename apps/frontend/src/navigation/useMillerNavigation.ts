/**
 * Hook for handling Miller List navigation
 * Provides callbacks for navigating between entities in Miller view
 */

import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildMillerNavigationUrl } from './linkExtractor';

export interface UseMillerNavigationResult {
  /** Navigate to an entity in Miller view */
  navigateToEntity: (targetConcept: string, itemId: string) => void;
  /** Navigate back by removing a level from the current path */
  navigateBack: () => void;
}

/**
 * Hook that provides navigation utilities for Miller List views.
 * Always operates in Miller context (concept pages are no longer available).
 */
export function useMillerNavigation(): UseMillerNavigationResult {
  const navigate = useNavigate();
  const location = useLocation();

  const navigateToEntity = useCallback(
    (targetConcept: string, itemId: string) => {
      if (!itemId) {
        console.warn('Cannot navigate to entity: no itemId provided');
        return;
      }

      const url = buildMillerNavigationUrl(location.pathname, targetConcept, itemId);
      navigate(url);
    },
    [navigate, location.pathname],
  );

  const navigateBack = useCallback(() => {
    // Go back one level by closing the last column
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length > 2) { // More than just /d/<root>
      const newPath = '/' + parts.slice(0, -1).join('/');
      navigate(newPath);
    }
  }, [navigate, location.pathname]);

  return {
    navigateToEntity,
    navigateBack,
  };
}
