/**
 * Session-only interaction state of a graph explorer (never persisted in the
 * ViewSpec, never written to storage). Keys are opaque node/group keys.
 */
export interface GraphSessionState {
  expanded: string[];
  collapsedGroups: string[];
  groupBy?: string;
  focus?: string;
  overrides?: Record<string, unknown>;
}

export const emptyGraphSessionState: GraphSessionState = { expanded: [], collapsedGroups: [] };

/** Removes duplicates without touching the array when there are none. */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length === values.length ? values : out;
}

/** Returns the state itself when its list is unchanged. */
function withList(state: GraphSessionState, field: 'expanded' | 'collapsedGroups', values: string[]): GraphSessionState {
  return values === state[field] ? state : { ...state, [field]: values };
}

export function toggleExpanded(state: GraphSessionState, key: string): GraphSessionState {
  const expanded = dedupe(state.expanded);
  return withList(state, 'expanded', expanded.includes(key) ? expanded.filter((k) => k !== key) : [...expanded, key]);
}

export function setExpanded(state: GraphSessionState, key: string, expanded: boolean): GraphSessionState {
  const values = dedupe(state.expanded);
  const present = values.includes(key);
  if (expanded === present) return withList(state, 'expanded', values);
  return withList(state, 'expanded', expanded ? [...values, key] : values.filter((k) => k !== key));
}

/** Collapses every given key (leaves the other expanded keys alone). */
export function collapseAll(state: GraphSessionState, keys: string[]): GraphSessionState {
  if (keys.length === 0) return withList(state, 'expanded', dedupe(state.expanded));
  const removed = new Set(keys);
  const unique = dedupe(state.expanded);
  const values = unique.some((k) => removed.has(k)) ? unique.filter((k) => !removed.has(k)) : unique;
  return withList(state, 'expanded', values);
}

export function setCollapsedGroup(state: GraphSessionState, key: string, collapsed: boolean): GraphSessionState {
  const values = dedupe(state.collapsedGroups);
  const present = values.includes(key);
  if (collapsed === present) return withList(state, 'collapsedGroups', values);
  return withList(state, 'collapsedGroups', collapsed ? [...values, key] : values.filter((k) => k !== key));
}

export function setGroupBy(state: GraphSessionState, field?: string): GraphSessionState {
  return state.groupBy === field ? state : { ...state, groupBy: field };
}

export function setFocus(state: GraphSessionState, key?: string): GraphSessionState {
  return state.focus === key ? state : { ...state, focus: key };
}

export function setOverride(state: GraphSessionState, key: string, value: unknown): GraphSessionState {
  const overrides = state.overrides;
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key) && Object.is(overrides[key], value)) return state;
  return { ...state, overrides: { ...overrides, [key]: value } };
}
