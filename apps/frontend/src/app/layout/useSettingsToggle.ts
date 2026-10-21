import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const SETTINGS_PATH = '/settings';

interface SettingsState {
  from?: string;
}

/**
 * Settings button behaviour: opens the settings page, and when already on it,
 * returns to the page it was opened from (or `/` when opened directly).
 */
export function useSettingsToggle() {
  const navigate = useNavigate();
  const location = useLocation();
  const open = location.pathname === SETTINGS_PATH;

  const toggle = useCallback(() => {
    if (open) {
      const from = (location.state as SettingsState | null)?.from;
      navigate(from ?? '/');
    } else {
      const from = `${location.pathname}${location.search}${location.hash}`;
      navigate(SETTINGS_PATH, { state: { from } satisfies SettingsState });
    }
  }, [open, location, navigate]);

  return { open, toggle };
}
