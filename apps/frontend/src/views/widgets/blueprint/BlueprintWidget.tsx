import { useMemo } from 'react';
import type { BlueprintWidget as BlueprintWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { NetworkEmpty } from '../network/NetworkEmpty';
import { blueprintProblem, buildBlueprint } from './blueprintModel';
import { BlueprintView } from './BlueprintView';

const DEFAULT_HEIGHT = 520;

/**
 * The Class Blueprint of one class (Moose `CBView`): its methods in five
 * columns (initialization, external interface, internal implementation by
 * call depth, accessors, attributes), box height = lines of code, color =
 * kind, arrows for internal calls and attribute accesses. Hovering highlights
 * an element's links; clicking emits its row on `selected` and opens it.
 *
 * Colors come from the theme (series by kind); a theme may set, under
 * `widgets.blueprint`: `constructorColor`, `abstractColor`, `overridingColor`,
 * `accessorColor`, `methodColor`, `attributeColor`, `edgeColor`, `highlightColor`.
 */
export function BlueprintWidget({
  widget,
  data,
  emit,
  fitHeight,
}: WidgetProps<BlueprintWidgetSpec>) {
  const height = fitHeight ?? widget.height ?? DEFAULT_HEIGHT;
  const blueprint = useMemo(() => buildBlueprint(data, widget), [data, widget]);
  const problem = blueprintProblem(data, blueprint, widget);
  if (problem) return <NetworkEmpty height={height} reason={problem} />;
  return <BlueprintView widget={widget} blueprint={blueprint} emit={emit} height={height} />;
}
