// Widget types: built-in types are plain words (`table`), plugin types are
// namespaced by the plugin that ships them (`tagcloud/cloud`).

/** Type of a plugin widget: `<pluginId>/<name>`. */
export const PLUGIN_WIDGET_TYPE = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;

export const isPluginWidgetType = (type: string): boolean => type.includes('/');

/** The plugin a widget type comes from (`null` for a built-in type). */
export const pluginOfWidgetType = (type: string): string | null =>
  isPluginWidgetType(type) ? type.slice(0, type.indexOf('/')) : null;
