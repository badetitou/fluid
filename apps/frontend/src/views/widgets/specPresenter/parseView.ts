import { z } from 'zod';
import { viewActionSchema, viewNodeSchema, type ViewAction, type ViewNode } from '@fluid/shared';

// Reading what the widget is given: a fluid Open Views response (`{ view,
// actions? }`) or a bare view node. Nodes of a kind fluid does not know become
// `unsupported` (done by `viewNodeSchema`).

/** What the widget draws: the view and the actions offered on it. */
export interface OpenViewDocument {
  node: ViewNode;
  actions: ViewAction[];
}

export type ParsedOpenView = { doc: OpenViewDocument; reason?: undefined } | { doc?: undefined; reason: string };

const actionsSchema = z.array(viewActionSchema);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function failure(error: z.ZodError, what: string): ParsedOpenView {
  const issue = error.issues[0];
  const where = issue?.path.length ? ` (at ${issue.path.join('.')})` : '';
  return { reason: `Not ${what}${where}: ${issue?.message ?? 'invalid'}.` };
}

/** The document in `data`, or why there is none to draw. */
export function parseOpenView(data: unknown): ParsedOpenView {
  if (data === undefined || data === null) {
    return { reason: 'No view to show: the data source returned nothing for this binding.' };
  }
  const wrapped = isRecord(data) && typeof data.kind !== 'string';
  const actions = actionsSchema.safeParse(wrapped ? (data.actions ?? []) : []);
  if (!actions.success) return failure(actions.error, 'a list of view actions');
  const node = viewNodeSchema.safeParse(wrapped ? data.view : data);
  if (!node.success) return failure(node.error, 'an Open Views document');
  return { doc: { node: node.data, actions: actions.data } };
}

/** The 0-based index of every list, columned list and tree, in document order (the items route `path`). */
export function pageableNodes(root: ViewNode): Map<ViewNode, number> {
  const indices = new Map<ViewNode, number>();
  const visit = (node: ViewNode): void => {
    if (node.kind === 'list' || node.kind === 'columnedList' || node.kind === 'tree') indices.set(node, indices.size);
    else if (node.kind === 'composite') node.children.forEach(visit);
    else if (node.kind === 'tabs') node.tabs.forEach((tab) => visit(tab.node));
  };
  visit(root);
  return indices;
}
