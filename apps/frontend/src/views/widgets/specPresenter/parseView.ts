import { z } from 'zod';
import {
  specFluidNodeSchema,
  specFluidNodeToViewNode,
  viewActionSchema,
  viewNodeSchema,
  VIEW_NODE_KINDS,
  type ViewAction,
  type ViewNode,
} from '@fluid/shared';

// Reading what the widget is given: a fluid Open Views response (`{ view,
// actions? }`), a bare view node, or an old Spec-Fluid node (or tab, with its
// `root`), converted. Nodes of a kind fluid does not know become `unsupported`.

/** What the widget draws: the view and the actions offered on it. */
export interface OpenViewDocument {
  node: ViewNode;
  actions: ViewAction[];
}

export type ParsedOpenView = { doc: OpenViewDocument; reason?: undefined } | { doc?: undefined; reason: string };

const KNOWN_KINDS = new Set<string>(VIEW_NODE_KINDS);
const actionsSchema = z.array(viewActionSchema);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Whether `raw` uses a field or kind only the old Spec-Fluid format has. */
export function looksLegacy(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.some(looksLegacy);
  if (!isRecord(raw)) return false;
  if (raw.kind === 'table' || raw.kind === 'notebook') return true;
  if ((raw.kind === 'svg' && 'refs' in raw) || (raw.kind === 'unsupported' && 'presenter' in raw) || 'hasMore' in raw) {
    return true;
  }
  return Object.values(raw).some(looksLegacy);
}

/** Replaces every node of an unknown kind by an `unsupported` one, as the protocol asks. */
export function unknownKindsAsUnsupported(raw: unknown): unknown {
  if (!isRecord(raw) || typeof raw.kind !== 'string') return raw;
  if (!KNOWN_KINDS.has(raw.kind)) return { kind: 'unsupported', type: raw.kind };
  if (raw.kind === 'composite' && Array.isArray(raw.children)) {
    return { ...raw, children: raw.children.map(unknownKindsAsUnsupported) };
  }
  if (raw.kind === 'tabs' && Array.isArray(raw.tabs)) {
    return { ...raw, tabs: raw.tabs.map((tab) => (isRecord(tab) ? { ...tab, node: unknownKindsAsUnsupported(tab.node) } : tab)) };
  }
  return raw;
}

function failure(error: z.ZodError, what: string): ParsedOpenView {
  const issue = error.issues[0];
  const where = issue?.path.length ? ` (at ${issue.path.join('.')})` : '';
  return { reason: `Not ${what}${where}: ${issue?.message ?? 'invalid'}.` };
}

/** The node of `raw`, read as Open Views, or as Spec-Fluid when it uses the old format. */
function parseNode(raw: unknown): { node: ViewNode } | { error: z.ZodError; what: string } {
  if (looksLegacy(raw)) {
    const legacy = specFluidNodeSchema.safeParse(raw);
    return legacy.success ? { node: specFluidNodeToViewNode(legacy.data) } : { error: legacy.error, what: 'a Spec-Fluid document' };
  }
  const parsed = viewNodeSchema.safeParse(unknownKindsAsUnsupported(raw));
  return parsed.success ? { node: parsed.data } : { error: parsed.error, what: 'an Open Views document' };
}

/** The document in `data`, or why there is none to draw. */
export function parseOpenView(data: unknown): ParsedOpenView {
  if (data === undefined || data === null) {
    return { reason: 'No view to show: the data source returned nothing for this binding.' };
  }
  const wrapped = isRecord(data) && typeof data.kind !== 'string';
  const raw = wrapped ? (data.view ?? data.root) : data;
  const actions = actionsSchema.safeParse(wrapped ? (data.actions ?? []) : []);
  if (!actions.success) return failure(actions.error, 'a list of view actions');
  const node = parseNode(raw);
  if ('error' in node) return failure(node.error, node.what);
  return { doc: { node: node.node, actions: actions.data } };
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
