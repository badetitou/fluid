// -----------------------------------------------------------------------------
// fluid Open Views — the data source contract inside fluid
// -----------------------------------------------------------------------------
// A View Builder exposes an Open Views provider to the views as a data source
// (`DataSource.run(query, variables)`). These are the queries it answers; the
// `specPresenter` widget runs `items`, `action` and `views`/`view` (for
// `forward` nodes) itself, with the variables of the query it is bound to.

/** Query names an Open Views data source answers, with their variables and result. */
export const OPEN_VIEWS_QUERIES = {
  /** `{ id }` → `ObjectViewsResponse` (`GET …/objects/<id>/views`). */
  views: 'views',
  /** `{ id, view }` → `ViewResponse` (`GET …/objects/<id>/views/<view>`). */
  view: 'view',
  /** `{ id, view, path, offset?, limit? }` → `ViewItemsResponse` (the items route). */
  items: 'items',
  /** `{ id, view, action }` → `ViewActionResult` (`POST …/actions/<action>`). */
  action: 'action',
} as const;
