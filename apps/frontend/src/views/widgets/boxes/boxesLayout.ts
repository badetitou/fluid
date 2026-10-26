import type { BoxesWidget } from '@fluid/shared';
import { layoutKind, type BoxesModel } from './boxesModel';
import { boxSizes, type BoxesLayout } from './boxesGeometry';
import { flowLayout } from './flowLayout';
import { treeLayout } from './treeLayout';
import { treemapLayout } from './treemapLayout';

export type { BoxesLayout, Edge, Frame, PlacedBox } from './boxesGeometry';

/** Places the boxes as the widget asks, within a `width` × `height` view (the treemap fills it exactly). */
export function layoutBoxes(model: BoxesModel, widget: BoxesWidget, width: number, height: number): BoxesLayout {
  const kind = layoutKind(widget);
  if (kind === 'treemap') return treemapLayout(model, widget.sizeField !== undefined, width, height);
  const sizes = boxSizes(model, widget);
  return kind === 'tree' ? treeLayout(model, sizes, width) : flowLayout(model, sizes, width);
}
