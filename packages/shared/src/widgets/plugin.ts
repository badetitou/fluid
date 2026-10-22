import { z } from 'zod';
import { dataBindingSchema, widgetBase } from './common';

/**
 * A widget shipped by a plugin (`type: "<pluginId>/<name>"`). The view spec only
 * checks what every widget shares and keeps the rest as is: the active plugin
 * catalog validates it against the plugin's own schema (see `plugins/catalog.ts`).
 */
export const pluginWidgetSchema = z.looseObject({
  // `<pluginId>/<name>`; the exact format is enforced on plugin contracts, and an
  // unknown type is rejected by the catalog check. A template literal (not a
  // refinement) keeps the widget schema convertible to JSON Schema.
  type: z.templateLiteral([z.string().min(1), '/', z.string().min(1)]),
  ...widgetBase,
  data: dataBindingSchema.optional(),
});
export type PluginWidget = z.infer<typeof pluginWidgetSchema>;

export const pluginWidgetDraftSchema = pluginWidgetSchema.omit({ id: true });
