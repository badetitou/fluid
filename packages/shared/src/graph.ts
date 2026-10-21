// -----------------------------------------------------------------------------
// Whole-graph dashboards
// -----------------------------------------------------------------------------
// Most views are bound to one concept. A *graph* dashboard is not: its queries
// may start from any root query field of the source. It is stored like any
// other view, under this reserved concept name (never a GraphQL type name, so
// it cannot clash with a real concept), and opens as the root column of
// `/miller/@graph`.

export const GRAPH_CONCEPT = '@graph';

export function isGraphConcept(name: string | undefined | null): boolean {
  return name === GRAPH_CONCEPT;
}

/** Name shown to the user for a concept (the graph pseudo-concept reads as such). */
export function conceptLabel(name: string): string {
  return isGraphConcept(name) ? 'the whole graph' : name;
}
