import type { Widget } from '@fluid/shared';
import { bffClient } from '../../bff/client';

/** Replace one widget of a saved view; resolves with the updated view. */
export const updateViewWidget = (viewId: string, widgetId: string, widget: Widget) =>
  bffClient.updateViewWidget(viewId, widgetId, widget);
