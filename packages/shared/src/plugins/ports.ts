import { z } from 'zod';

// Inputs and outputs of a widget. A widget reads its inputs from data bindings
// (`data`, plus any other `DataBinding` field of its config) and publishes its
// outputs with `emit(port, value)`. Another widget of the same view reads an
// output through the reserved query `@<widgetId>`, whose result is
// `{ <port>: <last value emitted> }`.

export const portShapeSchema = z.enum(['rows', 'object', 'value', 'any']);
export type PortShape = z.infer<typeof portShapeSchema>;

export const portSpecSchema = z.object({
  /** Port name: the config field of an input, the `emit` name of an output. */
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
  shape: portShapeSchema,
  description: z.string(),
});
export type PortSpec = z.infer<typeof portSpecSchema>;

/** Prefix of the reserved query reading another widget's outputs: `@<widgetId>`. */
export const WIDGET_OUTPUT_QUERY_PREFIX = '@';

/** The query key reading the outputs of widget `widgetId`. */
export const outputQuery = (widgetId: string): string => `${WIDGET_OUTPUT_QUERY_PREFIX}${widgetId}`;

/** The widget whose outputs a query key reads, or null for a regular query. */
export function outputSource(query: string): string | null {
  return query.startsWith(WIDGET_OUTPUT_QUERY_PREFIX)
    ? query.slice(WIDGET_OUTPUT_QUERY_PREFIX.length)
    : null;
}

/** The main input every data widget has. */
export const DATA_INPUT: PortSpec = {
  name: 'data',
  shape: 'any',
  description: 'The data binding the widget displays.',
};

/** The output of widgets whose rows can be selected. */
export const SELECTED_OUTPUT: PortSpec = {
  name: 'selected',
  shape: 'object',
  description: 'The row the user last clicked.',
};
