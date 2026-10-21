import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { columnSchema, dataBindingSchema, linkToSchema, widgetBase } from './common';

/** How an axis maps values: `linear`, or `log` (log10(1 + v), so 0 stays on the axis). */
export const axisScaleSchema = z.enum(['linear', 'log']);
export type AxisScale = z.infer<typeof axisScaleSchema>;

/**
 * Items placed as dots on two numeric axes (e.g. classes by number of methods ×
 * number of attributes). Hovering a dot shows the item's label, clicking it opens
 * the item in a new inspection column (`linkTo`).
 *
 * Numeric fields computed over nested lists (counts…) come from a `derive`
 * transform on the data binding.
 */
export const scatterWidgetSchema = z.object({
  type: z.literal('scatter'),
  ...widgetBase,
  data: dataBindingSchema,
  /** Dot path of the horizontal value of each row. */
  xField: z.string().min(1),
  /** Dot path of the vertical value of each row. */
  yField: z.string().min(1),
  /** Axis titles (default: the humanized field names). */
  xTitle: z.string().optional(),
  yTitle: z.string().optional(),
  xScale: axisScaleSchema.optional(),
  yScale: axisScaleSchema.optional(),
  /** Dot path of the text representing a row (default: name, title, label… whichever the row has). */
  labelField: z.string().min(1).optional(),
  /** Show the hover card (default true). */
  tooltip: z.boolean().optional(),
  /** Lines shown under the label on hover (default: the x and y values). */
  tooltipFields: z.array(columnSchema).optional(),
  /** Category field coloring the dots, with a legend. */
  colorField: z.string().min(1).optional(),
  /** Numeric field scaling the dots' radius. */
  sizeField: z.string().min(1).optional(),
  /** Dot radius in px (default 5; the smallest radius when `sizeField` is set). */
  pointSize: z.number().int().min(2).max(30).optional(),
  /** Spread dots sharing the same coordinates slightly apart (integer counts overlap a lot). */
  jitter: z.boolean().optional(),
  /** Opens the clicked dot's item in a new column. */
  linkTo: linkToSchema.optional(),
});
export type ScatterWidget = z.infer<typeof scatterWidgetSchema>;

/** How the LLM is told to use the scatter widget. */
export const scatterWidgetDoc = `- { "id": string, "type": "scatter", "title"?: string, "span"?: 1..24, "height"?: number,
    "data": { "query": ..., "path"?: ..., "transform"?: Transform },
    "xField": string, "yField": string, "xTitle"?: string, "yTitle"?: string,
    "xScale"?: "linear"|"log", "yScale"?: "linear"|"log", "labelField"?: string,
    "tooltip"?: boolean, "tooltipFields"?: [ Column, ... ], "colorField"?: string, "sizeField"?: string,
    "pointSize"?: number, "jitter"?: boolean, "linkTo"?: LinkConfig }
    Use it to place ITEMS on TWO NUMERIC AXES and spot outliers or correlations (e.g. classes by number of
    methods × number of attributes, characters by episodes × age). One dot per row; hovering shows the
    "labelField" text, clicking opens the item when "linkTo" is set — always set it when the rows have an id.
    Count nested lists with "derive" first (e.g. { "as": "methodCount", "op": "count", "field": "methods" })
    and use the derived names as xField/yField. Set "jitter": true for small integer counts, "log" scales
    for heavily skewed metrics.`;

/** A curated view showing the widget on the public Countries API (countries.trevorblades.com). */
export const countryScatterExample: ViewSpec = {
  version: 1,
  id: 'builtin:country-scatter',
  concept: 'Country',
  scope: 'list',
  title: 'Countries by states and languages',
  description: 'Each country placed by its number of states and of spoken languages.',
  queries: {
    countries: {
      query: /* GraphQL */ `
        query FluidCountryScatter {
          countries {
            code
            name
            capital
            continent {
              name
            }
            states {
              code
            }
            languages {
              code
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'scatter',
      type: 'scatter',
      title: 'States × languages',
      height: 360,
      data: {
        query: 'countries',
        path: 'countries',
        transform: {
          derive: [
            { as: 'stateCount', op: 'count', field: 'states' },
            { as: 'languageCount', op: 'count', field: 'languages' },
          ],
        },
      },
      xField: 'stateCount',
      yField: 'languageCount',
      xTitle: 'States',
      yTitle: 'Languages',
      xScale: 'log',
      labelField: 'name',
      tooltipFields: [
        { key: 'capital', title: 'Capital' },
        { key: 'stateCount', title: 'States' },
        { key: 'languageCount', title: 'Languages' },
      ],
      colorField: 'continent.name',
      jitter: true,
      linkTo: { concept: 'Country', idField: 'code' },
    },
  ],
};
