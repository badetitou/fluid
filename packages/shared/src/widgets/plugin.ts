import { z } from 'zod';
import { PLUGIN_WIDGET_TYPE } from '../plugins/widgetType';
import { dataBindingSchema, widgetBase } from './common';

/**
 * A widget shipped by a plugin (`type: "<pluginId>/<name>"`). The view spec only
 * checks what every widget shares and keeps the rest as is: the active plugin
 * catalog validates it against the plugin's own schema (see `plugins/catalog.ts`).
 */
export const pluginWidgetSchema = z.looseObject({
  type: z.custom<`${string}/${string}`>(
    (v) => typeof v === 'string' && PLUGIN_WIDGET_TYPE.test(v),
    'Plugin widget types are "<pluginId>/<name>"',
  ),
  ...widgetBase,
  data: dataBindingSchema.optional(),
});
export type PluginWidget = z.infer<typeof pluginWidgetSchema>;

export const pluginWidgetDraftSchema = pluginWidgetSchema.omit({ id: true });
