import { useCallback, useContext, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isOffered, useActivePageActions, type PageActionColumn } from '../../entities/plugin';
import { MillerColumnPathContext } from '../../navigation/columnPath';
import { useWidgetTheme } from '../../views/plugin-api';

/** The column a floating button is drawn on, but its path (read from the column). */
export type ColumnPlace = Omit<PageActionColumn, 'path'>;

/**
 * The commands of a column's floating button — the page actions of the
 * enabled plugins that this column offers — and the panel one of them opened.
 */
export function usePageActions({ concept, columnKind, itemId, view, openViewAssistant }: ColumnPlace) {
  const { pathname } = useLocation();
  const path = useContext(MillerColumnPathContext) ?? pathname;
  const { series, mode } = useWidgetTheme('page-actions');
  const active = useActivePageActions();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const commands = useMemo(() => {
    const column = { concept, columnKind, itemId, path, view, openViewAssistant };
    return active
      .map((a) => ({ ...a, context: { settings: a.settings, palette: series, mode, column } }))
      .filter(({ action, context }) => isOffered(action, context));
  }, [active, concept, columnKind, itemId, path, view, openViewAssistant, series, mode]);

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
  // A panel no longer offered (its plugin disabled, its setting cleared) closes.
  const open = commands.find((c) => c.key === openKey && c.action.Panel);

  return { commands, trigger, open, close };
}
