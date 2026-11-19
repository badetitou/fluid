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

const legacyItem = (item: unknown): boolean =>
  isRecord(item) && ('hasMore' in item || (Array.isArray(item.children) && item.children.some(legacyItem)));

type LegacyMark = 'kind' | 'field' | undefined;

const firstMark = (marks: LegacyMark[]): LegacyMark => (marks.includes('kind') ? 'kind' : marks.find(Boolean));

/**
 * What in the node `raw` belongs to the old Spec-Fluid format only: a `kind`
 * (`table`, `notebook`: surely Spec-Fluid) or a `field` (svg `refs`,
 * unsupported `presenter`, tree item `hasMore`: probably). Only node positions
 * and tree items are looked at, never the content of cells or texts.
 */
export function legacyMark(raw: unknown): LegacyMark {
  if (!isRecord(raw)) return undefined;
  switch (raw.kind) {
    case 'table':
    case 'notebook':
      return 'kind';
    case 'svg':
      return 'refs' in raw ? 'field' : undefined;
    case 'unsupported':
      return 'presenter' in raw ? 'field' : undefined;
    case 'tree':
      return Array.isArray(raw.roots) && raw.roots.some(legacyItem) ? 'field' : undefined;
    case 'composite':
      return Array.isArray(raw.children) ? firstMark(raw.children.map(legacyMark)) : undefined;
    case 'tabs':
      return Array.isArray(raw.tabs) ? firstMark(raw.tabs.map((tab) => (isRecord(tab) ? legacyMark(tab.node) : undefined))) : undefined;
    default:
      return undefined;
  }
}

/** Whether the node `raw` uses a kind or field only the old Spec-Fluid format has. */
export const looksLegacy = (raw: unknown): boolean => legacyMark(raw) !== undefined;

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

/**
 * The node of `raw`: as Spec-Fluid first when it uses the old format (read as
 * Open Views, a legacy `table` would become `unsupported` and svg `refs` would
 * be dropped), else as Open Views. A document only marked by a field (which an
 * Open Views provider may add) is read as Open Views when Spec-Fluid fails.
 */
function parseNode(raw: unknown): { node: ViewNode } | { error: z.ZodError; what: string } {
  const mark = legacyMark(raw);
  const legacy = mark ? specFluidNodeSchema.safeParse(raw) : undefined;
  if (legacy?.success) return { node: specFluidNodeToViewNode(legacy.data) };
  if (legacy && mark === 'kind') return { error: legacy.error, what: 'a Spec-Fluid document' };
  const parsed = viewNodeSchema.safeParse(unknownKindsAsUnsupported(raw));
  if (parsed.success) return { node: parsed.data };
  return legacy ? { error: legacy.error, what: 'a Spec-Fluid document' } : { error: parsed.error, what: 'an Open Views document' };
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
