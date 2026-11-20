import type { ViewItem, ViewItemsResponse, ViewNode } from '@fluid/shared';

// Items of lists and trees loaded after the view: the next pages of a node with
// a `total`, all of a `lazy` one, the children of a tree item with
// `hasChildren`. They come from the items route (see OPEN-VIEWS.md).

export type PageableNode = Extract<ViewNode, { kind: 'list' | 'columnedList' | 'tree' }>;

/** Asks the items route for `[offset, offset+limit)` of what `path` names. */
export type ItemsLoader = (path: string, offset: number, limit?: number) => Promise<ViewItemsResponse>;

/** What is loaded of a pageable node: its items (roots of a tree) and, when known, how many exist. */
export interface ItemsState {
  items: ViewItem[];
  total?: number;
}

/** Most pages fetched to load everything, so that a provider never ending its pages cannot loop forever. */
export const MAX_PAGES = 50;

/** The items a node was sent with. */
export function initialItems(node: PageableNode): ItemsState {
  return { items: node.kind === 'tree' ? node.roots : node.items, total: node.total };
}

/** How many items exist that are not loaded yet (0 when unknown). */
export const missingCount = (state: ItemsState): number =>
  state.total === undefined ? 0 : Math.max(0, state.total - state.items.length);

/** The items route `path` of a node (`index`) or of an item of its tree (`itemKey`, e.g. "3.0"). */
export const itemsPath = (index: number, itemKey?: string): string => (itemKey ? `${index}.${itemKey}` : String(index));

/** Appends a loaded page; the provider's new count wins. */
export const appendPage = (state: ItemsState, page: ViewItemsResponse): ItemsState => ({
  items: [...state.items, ...page.items],
  total: page.total ?? state.total,
});

/** Loads every item `path` names from `offset` on, page after page, until `total` is reached or a page is empty. */
export async function loadAll(load: ItemsLoader, path: string, offset = 0): Promise<ItemsState> {
  let state: ItemsState = { items: [] };
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const answer = await load(path, offset + state.items.length);
    state = appendPage(state, answer);
    if (answer.items.length === 0 || state.total === undefined || offset + state.items.length >= state.total) break;
  }
  return state;
}

/** The item at `key` ("0.2.1") of a tree, if any. */
export function itemAt(items: ViewItem[], key: string): ViewItem | undefined {
  const [first, ...rest] = key.split('.').map(Number);
  const item = items[first];
  return rest.length === 0 || !item ? item : itemAt(item.children ?? [], rest.join('.'));
}

/** Whether the item at `key` announces children that are not loaded yet. */
export function needsChildren(items: ViewItem[], key: string): boolean {
  const item = itemAt(items, key);
  return item?.hasChildren === true && item.children === undefined;
}

/** A copy of the tree `items` where the item at `key` has `children`. */
export function withChildren(items: ViewItem[], key: string, children: ViewItem[]): ViewItem[] {
  const [first, ...rest] = key.split('.').map(Number);
  return items.map((item, index) => {
    if (index !== first) return item;
    if (rest.length === 0) return { ...item, children };
    return { ...item, children: withChildren(item.children ?? [], rest.join('.'), children) };
  });
}
