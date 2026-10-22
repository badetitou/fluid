import type { GenerateWidgetInput } from './types';

/**
 * The view's actions a generated widget may run (a "form" action, table
 * "rowActions"): a widget draft cannot declare new ones, only use these keys.
 */
export function renderViewActions(input: Pick<GenerateWidgetInput, 'viewActions'>): string {
  const entries = Object.entries(input.viewActions ?? {});
  if (entries.length === 0) {
    return 'VIEW ACTIONS: none. Do not use a "form" widget nor "rowActions": they need an action of the view.';
  }
  return [
    'VIEW ACTIONS (mutations a "form" widget\'s "action" or a table\'s "rowActions" may run, by key; use only these keys):',
    ...entries.map(([key, mutation]) => `  "${key}": ${mutation}`),
    'A form passes "$target" (its bound object) and "$form" (the values); a row action passes the row as "$target".',
  ].join('\n');
}
