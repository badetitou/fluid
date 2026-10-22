import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DataBinding, Scene3dWidget as Scene3dWidgetSpec } from '@fluid/shared';
import { getPath } from '../../data';
import { useWidgetTheme } from '../../plugin-api';
import { useLinkHref } from '../useCellRenderer';
import { boundsOf, buildElements, categoryColors, DEFAULT_3D_HEIGHT, DEFAULT_HIDDEN_TYPES, highlightIds, type Element3d } from './sceneModel';
import { useElementMeshes } from './useElementMeshes';
import { usePicking } from './usePicking';
import { useViewport } from './useViewport';
import { Viewport3dFrame } from './Viewport3dFrame';

interface Scene3dWidgetProps {
  widget: Scene3dWidgetSpec;
  data: unknown;
  resolve: (binding: DataBinding) => unknown;
  emit: (port: string, value: unknown) => void;
  fitHeight?: number;
}

const DEFAULT_CONTEXT_OPACITY = 0.25;

/** A whole model in 3D: the highlighted elements stand out, the others fade; clicking selects. */
export function Scene3dWidget({ widget, data, resolve, emit, fitHeight }: Scene3dWidgetProps) {
  const theme = useWidgetTheme(widget.type);
  const navigate = useNavigate();
  const hrefOf = useLinkHref();
  const { labelField, colorField, representation, idField, hiddenTypes = DEFAULT_HIDDEN_TYPES } = widget;
  const elements = useMemo(
    () => buildElements(data, { labelField, colorField, representation, idField, hiddenTypes }),
    [data, labelField, colorField, representation, idField, hiddenTypes],
  );
  const highlightValue = widget.highlight ? resolve(widget.highlight) : undefined;
  const highlighted = useMemo(() => highlightIds(highlightValue, idField), [highlightValue, idField]);
  const isHighlighted = useCallback((e: Element3d) => e.id !== undefined && highlighted.has(e.id), [highlighted]);
  const hasHighlight = elements.some(isHighlighted);
  const colors = useMemo(() => categoryColors(elements, theme.series), [elements, theme.series]);

  const { primary, inkMuted, vars } = theme;
  const contextOpacity = widget.contextOpacity ?? DEFAULT_CONTEXT_OPACITY;
  const styleOf = useCallback(
    (e: Element3d) => {
      if (!hasHighlight) return { color: colors.get(e.category) ?? primary, opacity: 1 };
      return isHighlighted(e)
        ? { color: vars.highlight ?? primary, opacity: 1 }
        : { color: vars.context ?? inkMuted, opacity: contextOpacity };
    },
    [hasHighlight, isHighlighted, colors, primary, inkMuted, vars, contextOpacity],
  );

  const { ref, viewport, failed } = useViewport();
  const meshes = useElementMeshes(viewport, elements, styleOf, widget.edges ? (vars.edge ?? theme.ink) : undefined);
  const focus = widget.focusHighlight && hasHighlight ? elements.filter(isHighlighted) : elements;
  // Reframe when the model or the focused elements change, not on every highlight.
  const focusKey = focus.map((e) => e.key).join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => viewport?.frame(boundsOf(focus)), [viewport, focusKey]);

  const { linkTo, conceptField } = widget;
  const onClick = useCallback(
    (e: Element3d) => {
      emit('selected', e.row);
      const concept = conceptField ? getPath(e.row, conceptField) : undefined;
      const href = linkTo && hrefOf(e.row, typeof concept === 'string' ? { ...linkTo, concept } : linkTo);
      if (href) navigate(href);
    },
    [emit, linkTo, conceptField, hrefOf, navigate],
  );
  const hover = usePicking(viewport, meshes, onClick);

  const message = failed ? '3D is not available in this browser' : elements.length === 0 ? 'No geometry' : undefined;
  return (
    <Viewport3dFrame
      canvasRef={ref}
      height={fitHeight ?? widget.height ?? DEFAULT_3D_HEIGHT}
      message={message}
      hover={hover}
      legend={hasHighlight ? [] : [...colors].map(([name, color]) => ({ name, color }))}
    />
  );
}
