import { useCallback, useEffect, useMemo } from 'react';
import type { Model3dWidget as Model3dWidgetSpec } from '@fluid/shared';
import { useWidgetTheme } from '../../plugin-api';
import { boundsOf, buildElements, categoryColors, DEFAULT_3D_HEIGHT, type Element3d } from './sceneModel';
import { useElementMeshes } from './useElementMeshes';
import { usePicking } from './usePicking';
import { useViewport } from './useViewport';
import { Viewport3dFrame } from './Viewport3dFrame';

interface Model3dWidgetProps {
  widget: Model3dWidgetSpec;
  data: unknown;
  /** Height to fill (grid layout), overriding the widget's own `height`. */
  fitHeight?: number;
}

/** Building element(s) on their own, in 3D: drag to turn around them, scroll to zoom. */
export function Model3dWidget({ widget, data, fitHeight }: Model3dWidgetProps) {
  const theme = useWidgetTheme(widget.type);
  const { labelField, colorField, representation } = widget;
  const elements = useMemo(
    () => buildElements(data, { labelField, colorField, representation }),
    [data, labelField, colorField, representation],
  );
  const colors = useMemo(() => categoryColors(elements, theme.series), [elements, theme.series]);
  const styleOf = useCallback((e: Element3d) => ({ color: colors.get(e.category) ?? theme.primary, opacity: 1 }), [colors, theme.primary]);

  const { ref, viewport, failed } = useViewport();
  const meshes = useElementMeshes(viewport, elements, styleOf, widget.edges ? (theme.vars.edge ?? theme.ink) : undefined);
  useEffect(() => viewport?.frame(boundsOf(elements)), [viewport, elements]);
  const hover = usePicking(viewport, meshes);

  const message = failed ? '3D is not available in this browser' : elements.length === 0 ? 'No geometry' : undefined;
  return (
    <Viewport3dFrame
      canvasRef={ref}
      height={fitHeight ?? widget.height ?? DEFAULT_3D_HEIGHT}
      message={message}
      hover={hover}
      legend={[...colors].map(([name, color]) => ({ name, color }))}
    />
  );
}
