import { memo, Suspense, useCallback, useMemo } from 'react';
import { Skeleton } from 'antd';
import type { DataBinding, Widget } from '@fluid/shared';
import { resolveBinding } from './data';
import { RowsBanner } from './paging/RowsBanner';
import {
  MissingWidget,
  readsOutputs,
  useViewOutputs,
  useWidgetEmit,
  useWidgetInvoke,
  useWidgetRenderer,
} from './plugin-api';
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
  const invoke = useWidgetInvoke();
  const outputs = useViewOutputs(useMemo(() => readsOutputs(widget), [widget]));
  const resolve = useCallback(
    (binding: DataBinding) => resolveBinding(binding, { ...view.results, ...outputs }),
    [view.results, outputs],
  );
  const key = widget.data?.query;
  const owner = key ? view.rowsOwner?.[key] : undefined;
  // One banner per query: on the first widget reading it.
  const rows = key && (!owner || owner === widget.id) ? view.rows?.[key] : undefined;
  const loadRows = view.loadRows;
  const load = useMemo(() => (key && loadRows ? (kind: 'more' | 'all') => loadRows(key, kind) : undefined), [key, loadRows]);
  if (!definition) return <MissingWidget type={widget.type} />;
  const { Render } = definition;
  return (
    <Suspense fallback={<Skeleton active />}>
      {rows?.truncated && <RowsBanner rows={rows} load={load} />}
      <Render
        widget={widget}
        data={widget.data ? resolve(widget.data) : undefined}
        resolve={resolve}
        emit={emit}
        invoke={invoke}
        fitHeight={fitHeight}
      />
    </Suspense>
  );
});
