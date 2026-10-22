import { Suspense } from 'react';
import { Skeleton } from 'antd';
import type { DataBinding, Widget } from '@fluid/shared';
import { useWidgetRenderer } from '../plugin-api/catalogContext';
import { MissingWidget } from '../plugin-api/MissingWidget';
import { useWidgetEmit } from '../plugin-api/outputsContext';

/** A widget nested in another one (accordion panels), rendered from its parent's resolver. */
export function NestedWidget({
  widget,
  resolve,
}: {
  widget: Widget;
  resolve: (binding: DataBinding) => unknown;
}) {
  const definition = useWidgetRenderer(widget.type);
  const emit = useWidgetEmit(widget.id);
  if (!definition) return <MissingWidget type={widget.type} />;
  const { Render } = definition;
  return (
    <Suspense fallback={<Skeleton active />}>
      <Render
        widget={widget}
        data={widget.data ? resolve(widget.data) : undefined}
        resolve={resolve}
        emit={emit}
      />
    </Suspense>
  );
}
