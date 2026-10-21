import { memo, Suspense, type ComponentType } from 'react';
import { Skeleton } from 'antd';
import type { DataBinding, Widget } from '@fluid/shared';
import { resolveBinding } from './data';
import type { ViewData } from './useViewData';
import { WIDGET_RENDERERS, type WidgetRendererProps } from './widgets/catalog';

interface WidgetBodyProps {
  widget: Widget;
  view: ViewData;
  /** Makes charts fill a fixed-size grid cell. */
  fitHeight?: number;
}

/** Resolves a widget's data binding and renders it with the catalog's renderer for its type. */
export const WidgetBody = memo(function WidgetBody({ widget, view, fitHeight }: WidgetBodyProps) {
  const Render = WIDGET_RENDERERS[widget.type] as ComponentType<WidgetRendererProps> | undefined;
  if (!Render) return null;
  const resolve = (binding: DataBinding) => resolveBinding(binding, view.results);
  return (
    <Suspense fallback={<Skeleton active />}>
      <Render widget={widget} data={resolve(widget.data)} resolve={resolve} fitHeight={fitHeight} />
    </Suspense>
  );
});
