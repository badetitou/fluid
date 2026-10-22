import { memo, Suspense, useCallback, useMemo } from 'react';
import { Skeleton } from 'antd';
import type { DataBinding, Widget } from '@fluid/shared';
import { resolveBinding } from './data';
import { MissingWidget, readsOutputs, useViewOutputs, useWidgetEmit, useWidgetRenderer } from './plugin-api';
import type { ViewData } from './useViewData';

interface WidgetBodyProps {
  widget: Widget;
  view: ViewData;
  /** Makes charts fill a fixed-size grid cell. */
  fitHeight?: number;
}

/**
 * Resolves a widget's inputs and renders it with the active catalog's renderer
 * for its type. Inputs read the view's query results and, through `@<id>`
 * queries, what the other widgets emitted.
 */
export const WidgetBody = memo(function WidgetBody({ widget, view, fitHeight }: WidgetBodyProps) {
  const definition = useWidgetRenderer(widget.type);
  const emit = useWidgetEmit(widget.id);
  const outputs = useViewOutputs(useMemo(() => readsOutputs(widget), [widget]));
  const resolve = useCallback(
    (binding: DataBinding) => resolveBinding(binding, { ...view.results, ...outputs }),
    [view.results, outputs],
  );
  if (!definition) return <MissingWidget type={widget.type} />;
  const { Render } = definition;
  return (
    <Suspense fallback={<Skeleton active />}>
      <Render
        widget={widget}
        data={widget.data ? resolve(widget.data) : undefined}
        resolve={resolve}
        emit={emit}
        fitHeight={fitHeight}
      />
    </Suspense>
  );
});
