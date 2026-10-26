import { useMemo } from 'react';
import type { BoxesWidget } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import { flatTreeHint, layoutKind, type BoxesModel } from './boxesModel';
import { layoutBoxes, type BoxesLayout } from './boxesLayout';
import { boxFills, boxesPalette, paletteVariables } from './boxesStyle';
import { BoxesCanvas } from './BoxesCanvas';
import { BoxesLegend } from './BoxesLegend';
import { ZoomToolbar } from '../zoom/ZoomToolbar';
import { BoxesTooltip } from './BoxesTooltip';
import { useBoxesSelection } from './useBoxesSelection';
import { useZoomPan } from '../zoom/useZoomPan';
import styles from './Boxes.module.css';

interface BoxesViewProps {
  widget: BoxesWidget;
  model: BoxesModel;
  emit: (port: string, value: unknown) => void;
  /** Height of the whole widget: hint, drawing and legend. */
  height: number;
}

const LEGEND_HEIGHT = 28;
const HINT_HEIGHT = 22;
const MIN_HEIGHT = 140;
const EMPTY: BoxesLayout = { boxes: [], frames: [], edges: [], width: 0, height: 0 };

/** The drawing, measured to its column's width, with its zoom buttons, hover card and legend. */
export function BoxesView({ widget, model, emit, height }: BoxesViewProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const theme = useWidgetTheme(widget.type);
  const palette = useMemo(() => boxesPalette(theme), [theme]);
  const fills = useMemo(() => boxFills(model, palette), [model, palette]);
  const selection = useBoxesSelection(widget, model, emit);
  const hint = layoutKind(widget) === 'tree' ? flatTreeHint(model, widget.parentField) : null;
  const canvasHeight = Math.max(
    MIN_HEIGHT,
    height - (model.color.kind === 'none' ? 0 : LEGEND_HEIGHT) - (hint ? HINT_HEIGHT : 0),
  );
  const view = useMemo(() => ({ width: Math.floor(width), height: canvasHeight }), [width, canvasHeight]);
  const layout = useMemo(
    () => (view.width > 0 ? layoutBoxes(model, widget, view.width, view.height) : EMPTY),
    [model, widget, view],
  );
  const zoom = useZoomPan(layout, view);
  const hovered = layout.boxes.find((b) => b.key === selection.hovered);
  const hoveredItem = hovered && model.items.get(hovered.key);

  return (
    <div className={styles.frame} style={paletteVariables(palette)}>
      {hint && <div className={styles.hint}>{hint}</div>}
      <div ref={ref} className={styles.viewport} style={{ height: canvasHeight }}>
        {view.width > 0 && (
          <BoxesCanvas
            model={model}
            layout={layout}
            fills={fills}
            selection={selection}
            zoom={zoom}
            highlightGroup={widget.highlightGroup ?? widget.groupField !== undefined}
            label={widget.title ?? 'Boxes'}
          />
        )}
        <ZoomToolbar zoom={zoom} caption={model.order.length === 1 ? '1 box' : `${model.order.length} boxes`} />
        {hovered && hoveredItem && (
          <BoxesTooltip item={hoveredItem} at={hovered} transform={zoom.transform} widget={widget} viewWidth={view.width} />
        )}
      </div>
      <BoxesLegend scale={model.color} palette={palette} />
    </div>
  );
}
