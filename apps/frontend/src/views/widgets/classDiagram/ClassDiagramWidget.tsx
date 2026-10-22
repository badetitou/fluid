import { useMemo } from 'react';
import type { ClassDiagramWidget as ClassDiagramWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { NetworkEmpty } from '../network/NetworkEmpty';
import { buildClassForest, emptyReason } from './classDiagramModel';
import { ClassDiagramView } from './ClassDiagramView';

const DEFAULT_HEIGHT = 520;

/**
 * An inheritance hierarchy as a UML class diagram: superclasses on top, boxes
 * with name, attributes and methods, inheritance arrows, foldable branches.
 * Clicking a class name emits its row on `selected` and opens it in a new column.
 *
 * Colors come from the theme (series by package); a theme may set, under
 * `widgets.classDiagram`: `lineColor`, `boxColor`, `headerColor`,
 * `borderColor`, `selectionColor`.
 */
export function ClassDiagramWidget({ widget, data, emit, fitHeight }: WidgetProps<ClassDiagramWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const forest = useMemo(() => buildClassForest(data, widget), [data, widget]);
  const reason = emptyReason(data, forest, widget.idField);
  if (reason) return <NetworkEmpty height={height} reason={reason} />;
  return <ClassDiagramView widget={widget} forest={forest} emit={emit} height={height} />;
}
