import * as React from 'react';
import * as antd from 'antd';
import { useWidgetTheme } from '../../views/plugin-api';

/** Version of the API a plugin module receives; bumped on breaking changes. */
export const PLUGIN_API_VERSION = 1;

/**
 * What fluid hands a plugin module: the libraries it renders with (so a plugin
 * needs no bundler and shares fluid's React) and the widget hooks. Loaded only
 * when a plugin module is, since it pulls the whole of antd.
 */
export function createPluginHost() {
  return { apiVersion: PLUGIN_API_VERSION, React, antd, useWidgetTheme };
}
export type PluginHost = ReturnType<typeof createPluginHost>;
