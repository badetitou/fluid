import {
  checkWidgetsAgainstCatalog,
  describeIssues,
  widgetSchema,
  type ViewSpec,
  type ViewWidgetInfo,
  type Widget,
  type WidgetContract,
} from '@fluid/shared';

/** Every widget of the view, nested ones included. */
function allWidgets(widgets: Widget[]): Widget[] {
  return widgets.flatMap((w) => [
    w,
    ...('widgets' in w && Array.isArray(w.widgets) ? allWidgets(w.widgets as Widget[]) : []),
  ]);
}

/** The other widgets of the view, with their outputs: the agent may wire the edited widget to them. */
export function otherWidgets(
  spec: ViewSpec,
  editedId: string,
  contracts: WidgetContract[],
): ViewWidgetInfo[] {
  const outputs = new Map(contracts.map((c) => [c.type, c.outputs.map((o) => o.name)]));
  return allWidgets(spec.widgets)
    .filter((w) => w.id !== editedId)
    .map((w) => ({ id: w.id, type: w.type, title: w.title, outputs: outputs.get(w.type) }));
}

/**
 * Validates a widget the model proposed: the widget schema, then the active
 * catalog (enabled type, plugin schema, `@<id>` bindings to widgets of the view).
 * Returns the widget or the problem to show.
 */
export function checkProposal(
  raw: unknown,
  spec: ViewSpec,
  contracts: WidgetContract[],
): { widget: Widget } | { error: string } {
  const parsed = widgetSchema.safeParse(raw);
  if (!parsed.success)
    return { error: `The model returned an invalid widget:\n${describeIssues(parsed.error, 3)}` };
  const ids = new Set(allWidgets(spec.widgets).map((w) => w.id));
  const problems = checkWidgetsAgainstCatalog([parsed.data], contracts, 'widget', ids);
  if (problems.length)
    return { error: `The model returned an unusable widget:\n${problems.slice(0, 3).join('\n')}` };
  return { widget: parsed.data };
}
