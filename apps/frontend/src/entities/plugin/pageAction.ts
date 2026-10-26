import type { ComponentType } from 'react';
import type { ColumnKind } from '../../views/viewScope';
import type { PageActionContract } from './manifest';
import { isEnabled, pageActionsOf, settingsOf } from './model';
import type { FluidPlugin } from './types';

/** The Miller column a page action is offered on. */
export interface PageActionColumn {
  concept: string;
  columnKind: ColumnKind;
  /** The item shown, in a detail column. */
  itemId?: string;
  /** The column's path (`/d/…`): links append to it, opening the next column. */
  path: string;
}

/** What a page action knows when it is offered and run. */
export interface PageActionContext {
  /** The plugin's settings, as the user filled them in Settings → Plugins. */
  settings: Readonly<Record<string, string>>;
  /** The active theme's series palette and mode. */
  palette: readonly string[];
  mode: 'light' | 'dark';
  /** The column whose floating button offers it. */
  column: PageActionColumn;
}

/** What the panel of a page action receives; fluid docks it under the column body. */
export interface PageActionPanelProps {
  context: PageActionContext;
  onClose: () => void;
}

/**
 * The code half of a page action, one command of the floating button of each
 * Miller column: it `run`s at once (an effect on the page), or opens its `Panel`.
 */
export interface PageAction {
  id: string;
  label: string;
  description?: string;
  /** A short symbol (an emoji) shown on its button, from the manifest. */
  icon?: string;
  /** Its icon, drawn by the plugin's code (in place of `icon`). */
  Icon?: ComponentType;
  /** Whether it is offered on this column (always, when left out). */
  available?: (context: PageActionContext) => boolean;
  run?: (context: PageActionContext) => void;
  Panel?: ComponentType<PageActionPanelProps>;
}

/** A module's entry for a page action, checked: it runs, or has a panel. */
export function modulePageAction(contract: PageActionContract, entry: Record<string, unknown> | undefined): PageAction {
  const { run, available, Panel, Icon } = entry ?? {};
  if (typeof run !== 'function' && typeof Panel !== 'function')
    throw new Error(`The plugin module neither runs nor draws the page action “${contract.id}”.`);
  return {
    ...contract,
    run: typeof run === 'function' ? (run as PageAction['run']) : undefined,
    available: typeof available === 'function' ? (available as PageAction['available']) : undefined,
    Panel: typeof Panel === 'function' ? (Panel as PageAction['Panel']) : undefined,
    Icon: typeof Icon === 'function' ? (Icon as PageAction['Icon']) : undefined,
  };
}

/** Whether a page action is offered in this context. */
export const isOffered = (action: PageAction, context: PageActionContext): boolean =>
  action.available?.(context) ?? true;

/** A page action of an enabled plugin, with that plugin's settings. */
export interface ActivePageAction {
  /** Unique among the active actions: `<pluginId>/<actionId>`. */
  key: string;
  action: PageAction;
  settings: Record<string, string>;
}

/** The page actions of the enabled plugins, in plugin order, with their settings. */
export function activePageActions(
  plugins: FluidPlugin[],
  disabled: readonly string[],
  filled: Readonly<Record<string, Record<string, string>>>,
): ActivePageAction[] {
  return plugins
    .filter((p) => isEnabled(p, disabled))
    .flatMap((p) =>
      pageActionsOf(p).map((action) => ({
        key: `${p.manifest.id}/${action.id}`,
        action,
        settings: settingsOf(p, filled),
      })),
    );
}
