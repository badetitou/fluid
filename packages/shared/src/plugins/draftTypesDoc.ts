// Reference of the types the widget docs (`renderWidgetDocs`) point to: LinkConfig, Transform,
// Format. Shared by the BFF prompts and the MCP `draft_view` tool description.

export const VIEW_DRAFT_TYPES_DOC = `LinkConfig (FEATURE: Infinite Navigation - enables Miller list-style drilling):
  "linkTo": { "concept": "<target concept name>", "idField"?: "<dot path to ID>" }
  - "concept": The target concept to navigate to (e.g., "Customer", "Order", "Product")
  - "idField": Optional dot path to extract the ID (defaults to "id"). Supports nested paths like "customer.id"
  - When a column or item has linkTo, clicking it opens a new Miller column showing that item's detail view
  - This enables INFINITE NAVIGATION: explore related objects by clicking links in tables or descriptions
  - Examples:
    * {"concept": "Account"} on an "id" column → opens the Account whose id is the row's "id"
    * {"concept": "Customer", "idField": "customer.id"} → opens the Customer whose id is the row's "customer.id"

Transform (optional) reshapes an array before rendering:
{ "derive"?: [ { "as": "<new field>", "op": "count"|"sum"|"avg"|"min"|"max"|"first", "field"?: "<dot path, may cross nested lists>" } ],
  "groupBy"?: "<field>", "aggregate"?: { "field"?: "<numeric field>" },
  "sort"?: { "by": "<field>", "dir": "asc"|"desc" }, "limit"?: number }
"derive" runs first and adds per-row computed fields over nested data, e.g. on customer rows
{ "as": "totalSpent", "op": "sum", "field": "accounts.transactions.amount" } — then sort/display "totalSpent".
When "groupBy" is set the rows become { "<groupBy>": value, "count": n, "sum": n, "avg": n, "min": n, "max": n }.
So a category breakdown = groupBy + a "bar"/"pie" widget with xField/colorField = "<groupBy>" and yField/angleField = "count" (or "sum").

Format is one of: "text","number","currency","percent","date","datetime","tag","boolean","image","markdown","code".
"image" is only for String fields holding a picture URL (avatar, portrait, photo, logo…); the user must click to load it.
"markdown" renders Markdown text, "code" source code (short values inline, multi-line as a block).`;
