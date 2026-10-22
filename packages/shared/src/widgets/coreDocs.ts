// How the LLM is told to use the widgets whose schema lives in `view-spec.ts`.
// The other widgets keep their doc next to their schema (`tree.ts`, `code.ts`…).

const DATA = `"data": { "query": "<queries key>", "path"?: "<dot path to array/object>", "transform"?: Transform }`;

export const statisticWidgetDoc = `- { "id": string, "type": "statistic", "title"?: string, "span"?: 1..24,
    ${DATA},
    "value": { "op": "count"|"sum"|"avg"|"min"|"max"|"first", "field"?: string }, "format"?: "number"|"currency"|"percent",
    "currency"?: string, "precision"?: 0..6, "prefix"?: string, "suffix"?: string }
    ONE NUMBER aggregated over the rows ("field" is required except for "count").`;

export const tableWidgetDoc = `- { "id": string, "type": "table", "title"?: string, "span"?: 1..24,
    ${DATA},
    "columns": [ { "key": string, "title"?: string, "format"?: Format, "currency"?: string, "linkTo"?: LinkConfig, "width"?: number } ],
    "pageSize"?: number, "sortable"?: boolean, "filterable"?: boolean }  // header sorting / value filters, default true; set false only on request
    ⭐ THE PRIMARY WIDGET FOR INTERACTIVE NAVIGATION: every column showing an id or a relationship MUST have "linkTo" ⭐`;

export const descriptionsWidgetDoc = `- { "id": string, "type": "descriptions", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: ... },
    "items": [ { "label": string, "key": string, "format"?: Format, "currency"?: string, "linkTo"?: LinkConfig } ], "columns"?: 1..4 }
    The fields of ONE object (or the first element of an array).`;

const cartesianDoc = (
  type: string,
  what: string,
) => `- { "id": string, "type": "${type}", "title"?: string, "span"?: 1..24,
    ${DATA},
    "xField": string, "yField": string, "colorField"?: string, "height"?: number }
    ${what}; "colorField" splits the data into coloured series.`;

export const lineWidgetDoc = cartesianDoc(
  'line',
  'A line chart, for trends (sort a time series by its date field)',
);
export const areaWidgetDoc = cartesianDoc('area', 'An area chart, for volumes over time');
export const barWidgetDoc = cartesianDoc(
  'bar',
  'Vertical columns, for comparing categories (often after a "groupBy")',
);

export const pieWidgetDoc = `- { "id": string, "type": "pie", "title"?: string, "span"?: 1..24,
    ${DATA},
    "angleField": string, "colorField": string, "height"?: number }
    Shares of a whole: "angleField" is numeric (e.g. "count" after a groupBy), "colorField" the category.`;
