import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { columnSchema, dataBindingSchema, linkToSchema, widgetBase } from './common';

/**
 * A hierarchy (parent/children, container/contents…) shown as a file-explorer
 * tree, or as a table with expandable rows when `columns` are given.
 *
 * The rows are nested in one of three ways:
 * - `childrenField: "children"` — recursive: every node holds its children
 *   under the same field (folders, categories, comment replies…). When the
 *   bound array also lists the descendants themselves, they are shown once,
 *   under their parent.
 * - `childrenField: ["countries", "states"]` — one field per level, for a
 *   container chain of different types (continent › countries › states).
 * - `parentField: "parent.id"` — a flat list where each row points to its
 *   parent's key; rows without a (known) parent are the roots.
 */
export const treeWidgetSchema = z.object({
  type: z.literal('tree'),
  ...widgetBase,
  data: dataBindingSchema,
  childrenField: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
  /** Dot path, in each row, to its parent's key (flat lists). */
  parentField: z.string().min(1).optional(),
  /** Dot path to a row's key (default "id"). */
  keyField: z.string().min(1).optional(),
  /** Dot path to a node's label (default: name, title, label… whichever the row has). */
  labelField: z.string().min(1).optional(),
  /** When set, the tree is rendered as a table whose rows expand. */
  columns: z.array(columnSchema).optional(),
  /**
   * Opens the clicked node in a new inspection column: one link for every node
   * (recursive trees of one concept), or one per level (container chains; `null`
   * for a level that cannot be opened).
   */
  linkTo: z.union([linkToSchema, z.array(linkToSchema.nullable())]).optional(),
  /** Levels expanded on first render (default 1). */
  expandDepth: z.number().int().min(0).max(10).optional(),
});
export type TreeWidget = z.infer<typeof treeWidgetSchema>;

/** How the LLM is told to use the tree widget. */
export const treeWidgetDoc = `- { "id": string, "type": "tree", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: ... },
    "childrenField"?: string | string[], "parentField"?: string, "keyField"?: string, "labelField"?: string,
    "columns"?: [ Column, ... ], "linkTo"?: LinkConfig, "expandDepth"?: number }
    Use it for HIERARCHIES (parent/children, container/contents, folders/files, categories, threads):
    * recursive children (a type holding a list of itself): "childrenField": "children", and select the
      children several levels deep in GraphQL (e.g. \`children { id name children { id name } }\`);
    * container chain of different types: one field per level, e.g. "childrenField": ["countries", "states"]
      on continents selected as \`continents { name countries { name states { name } } }\`;
    * flat rows pointing to their parent: "parentField": "parent.id" (select \`parent { id }\`).
    Without "columns" it renders a file-explorer tree; with "columns" a table with expandable rows.
    Set "linkTo" so a click on a node opens it in a new column: one LinkConfig, or one per level
    (e.g. [{ "concept": "Continent", "idField": "code" }, { "concept": "Country", "idField": "code" }, null]).`;

/** A curated view showing the widget on the public Countries API (countries.trevorblades.com). */
export const continentTreeExample: ViewSpec = {
  version: 1,
  id: 'builtin:continent-tree',
  concept: 'Continent',
  scope: 'list',
  title: 'Continents tree',
  description: 'Continents, their countries and the states of each country.',
  queries: {
    world: {
      query: /* GraphQL */ `
        query FluidContinentTree {
          continents {
            code
            name
            countries {
              code
              name
              capital
              states {
                code
                name
              }
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'tree',
      type: 'tree',
      title: 'Continents › countries › states',
      span: 12,
      data: { query: 'world', path: 'continents' },
      keyField: 'code',
      childrenField: ['countries', 'states'],
      linkTo: [{ concept: 'Continent', idField: 'code' }, { concept: 'Country', idField: 'code' }, null],
    },
    {
      id: 'tree-table',
      type: 'tree',
      title: 'As a table',
      span: 12,
      data: { query: 'world', path: 'continents' },
      keyField: 'code',
      childrenField: ['countries', 'states'],
      linkTo: [{ concept: 'Continent', idField: 'code' }, { concept: 'Country', idField: 'code' }, null],
      columns: [
        { key: 'name', title: 'Name' },
        { key: 'code', title: 'Code', format: 'tag' },
        { key: 'capital', title: 'Capital' },
      ],
    },
  ],
};
