import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sectionOf, type SettingsSectionId } from './sections';

/** The settings section shown, kept in the URL (`?section=`) so it can be linked and survives a reload. */
export function useSettingsSection() {
  const [params, setParams] = useSearchParams();
  const section = sectionOf(params.get('section'));
  const open = useCallback(
    (id: SettingsSectionId) => setParams((p) => ({ ...Object.fromEntries(p), section: id }), { replace: true }),
    [setParams],
  );
  return { section, open };
}
