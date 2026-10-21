import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { columnSchema, dataBindingSchema, widgetBase } from './common';

/**
 * A collection shown as a stack of folding panels, one per element: a header
 * (label + a few summary fields) and, once unfolded, any composition of widgets
 * about that element. A compact alternative to a big table when each element
 * has details worth showing (source files, methods, orders and their lines…).
 *
 * The nested widgets read the panel's element through the reserved query key
 * `ACCORDION_ITEM_QUERY` (`data: { query: "$item", path: "sourceCode" }`); they
 * can still bind to any query of the view. Accordions can be nested: `$item`
 * is then the innermost element.
 *
 * The `widgets` field is recursive, so it is added in `view-spec.ts`, next to
 * the widget union it refers to.
 */
export const ACCORDION_ITEM_QUERY = '$item';

export const accordionWidgetFields = {
  ...widgetBase,
  /** Binds to the collection: one panel per element. */
  data: dataBindingSchema,
  /** Dot path to an element's key (default "id", else its position). */
  keyField: z.string().min(1).optional(),
  /** Dot path to a panel's label (default: name, title, label… whichever the element has). */
  labelField: z.string().min(1).optional(),
  /** Fields shown on the right of each header, formatted like table cells (linkTo opens the element). */
  summary: z.array(columnSchema).optional(),
  /** Panels unfolded on first render (default "none": everything folded). */
  expanded: z.enum(['none', 'first', 'all']).optional(),
  /** Unfolding a panel folds the others (default false). */
  single: z.boolean().optional(),
  /** Panels per page (default 20). */
  pageSize: z.number().int().positive().optional(),
};

/** How the LLM is told to use the accordion widget. */
export const accordionWidgetDoc = `- { "id": string, "type": "accordion", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: "<dot path to the list>" }, "keyField"?: string, "labelField"?: string,
    "summary"?: [ Column, ... ], "expanded"?: "none"|"first"|"all", "single"?: boolean, "pageSize"?: number,
    "widgets": [ Widget, ... ] }
    A COLLECTION OF FOLDING PANELS: one panel per element, titled by "labelField" with the "summary"
    columns on the right; unfolding it shows "widgets" (any widget types, each with its own "id").
    Inside "widgets", bind to the panel's element with "data": { "query": "${ACCORDION_ITEM_QUERY}", "path"?: "<field>" }
    (e.g. a "code" widget with "field": "sourceCode", a "descriptions" of the element, a "table" of
    "path": "lines"). Panels are folded by default ("expanded": "none"); use "first" or "all" only on request.
    Prefer it over a big table when each element has details or long text (source files, methods,
    commits and their changes, orders and their lines…).`;

/**
 * A curated view for APIs exposing a `Class` concept with its methods (code
 * analysis, e.g. Moose or a Pharo image): each method folded, its source and
 * critiques shown once unfolded. No public API ships one: it serves as a reference.
 */
export const classMethodsExample: ViewSpec = {
  version: 1,
  id: 'builtin:class-methods',
  concept: 'Class',
  scope: 'detail',
  title: 'Class methods',
  description: 'The methods of a class, folded, with their source and critiques.',
  queries: {
    class: {
      query: /* GraphQL */ `
        query FluidClassMethods($id: ID!) {
          class(id: $id) {
            id
            name
            methods {
              id
              selector
              protocol
              linesOfCode
              sourceCode
              critiques {
                rule
                message
                severity
                line
              }
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'methods',
      type: 'accordion',
      title: 'Methods',
      data: { query: 'class', path: 'class.methods' },
      labelField: 'selector',
      summary: [
        { key: 'protocol', format: 'tag' },
        { key: 'linesOfCode', title: 'lines', format: 'number' },
        { key: 'id', title: 'open', linkTo: { concept: 'Method' } },
      ],
      widgets: [
        {
          id: 'source',
          type: 'code',
          data: { query: ACCORDION_ITEM_QUERY },
          field: 'sourceCode',
          language: 'smalltalk',
          search: false,
          annotations: {
            field: 'critiques',
            lineField: 'line',
            messageField: 'message',
            severityField: 'severity',
            ruleField: 'rule',
          },
        },
      ],
    },
  ],
};
