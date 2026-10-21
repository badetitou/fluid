import { useEffect } from 'react';
import { bffClient } from '../../bff/client';
import { usePreferences } from '../../store';

/**
 * The BFF is the shared source of truth for preferences when reachable;
 * localStorage (zustand persist) stays the offline fallback.
 */
export function useServerPreferences() {
  const setNavbarSide = usePreferences((s) => s.setNavbarSide);

  useEffect(() => {
    let cancelled = false;
    bffClient
      .getPrefs()
      .then((prefs) => {
        const side = prefs.navbarSide;
        if (!cancelled && (side === 'left' || side === 'right')) setNavbarSide(side);
      })
      .catch(() => {
        /* BFF unavailable — keep the local preference */
      });
    return () => {
      cancelled = true;
    };
  }, [setNavbarSide]);
}
