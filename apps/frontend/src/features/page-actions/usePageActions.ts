import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isOffered, useActivePageActions, type PageActionContext } from '../../entities/plugin';
import { useWidgetTheme } from '../../views/plugin-api';
import { pageFocus } from './model';

/** What a page action may read of the page, but its own settings. */
type PageState = Omit<PageActionContext, 'settings'>;

/**
 * The commands of the floating button on this page — the page actions of the
 * enabled plugins that are offered here — and the panel one of them opened.
 */
export function usePageActions() {
  const { pathname } = useLocation();
  const { series, mode } = useWidgetTheme('page-actions');
  const active = useActivePageActions();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const page = useMemo<PageState>(
    () => ({ palette: series, mode, focus: pageFocus(pathname) }),
    [series, mode, pathname],
  );
  const commands = useMemo(
    () =>
      active
        .map((a) => ({ ...a, context: { ...page, settings: a.settings } }))
        .filter(({ action, context }) => isOffered(action, context)),
    [active, page],
  );

  const trigger = useCallback(
    (key: string) => {
      const command = commands.find((c) => c.key === key);
      if (!command) return;
      if (command.action.Panel) setOpenKey(key);
      else command.action.run?.(command.context);
    },
    [commands],
  );
  const close = useCallback(() => setOpenKey(null), []);
  // A panel no longer offered (the column it was about closed) closes.
  const open = commands.find((c) => c.key === openKey && c.action.Panel);

  return { commands, trigger, open, close };
}
