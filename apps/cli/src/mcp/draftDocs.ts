import { mcpWidgetCatalog, renderPortDocs, renderWidgetDocs, VIEW_DRAFT_TYPES_DOC } from '@fluid/shared';

// The `draft_view` description: the draft format, with the widgets the viewer can draw.

export const DRAFT_VIEW_DESCRIPTION = `Write a fluid view for the user's request, run it on a data source and show it in the viewer.
fluid checks the draft like its own assistant (widget shapes, wiring, queries against the source schema), runs its queries and returns the data with any issues.
When issues come back, fix the draft and call draft_view again. The user saves it with the viewer's "Save in fluid" button: it then opens in fluid and in show_view, for good.
Before writing queries, read the source schema with get_source_schema (sourceId from list_sources).

The "view" argument is a view draft:
{
  "title": string,
  "description"?: string,
  "queries": { "<key>": { "query": "<GraphQL query document>", "variables"?: { ... } } },
  "widgets": [ Widget, ... ]
}

Rules:
- Queries are read-only: one "query" operation each, using only fields of the source schema.
- Row limit: when the list field has one, pass it through a variable named exactly $take ("query($take: Int) { items(first: $take) { … } }", "variables": { "take": 100 }); fluid sets it.
- Every widget.data.query is a key of "queries"; "path" is the dot path from the query result to the rows (it crosses nested lists).
- Every widget has a unique "id". Prefer a few statistics, one table with links ("linkTo") and a chart or two.

Each Widget is one of these shapes (field "type"); use ONLY these types:
${renderWidgetDocs(mcpWidgetCatalog())}
${renderPortDocs(mcpWidgetCatalog())}

${VIEW_DRAFT_TYPES_DOC}`;
