import type { BoxesModel } from './boxesModel';
import type { BoxesLayout } from './boxesLayout';
import type { BoxesSelection } from './useBoxesSelection';
import type { ZoomPan } from '../zoom/useZoomPan';
import { BoxRect, type BoxStatus } from './BoxRect';
import { BoxesFrames } from './BoxesFrames';
import styles from './Boxes.module.css';

interface BoxesCanvasProps {
  model: BoxesModel;
  layout: BoxesLayout;
  /** The fill of each box. */
  fills: ReadonlyMap<string, string>;
  selection: BoxesSelection;
  zoom: ZoomPan;
  /** Hovering a box highlights its group. */
  highlightGroup: boolean;
  label: string;
}

/** The SVG plane: frames, parent → child edges and boxes, zoomed and panned. */
export function BoxesCanvas({ model, layout, fills, selection, zoom, highlightGroup, label }: BoxesCanvasProps) {
  const { x, y, k } = zoom.transform;
  const hoveredGroup = highlightGroup && selection.hovered ? model.items.get(selection.hovered)?.group : undefined;
  const statusOf = (key: string, group?: string): BoxStatus | undefined => {
    if (key === selection.selected) return 'selected';
    if (hoveredGroup === undefined) return undefined;
    return group === hoveredGroup ? 'peer' : 'dimmed';
  };
  const open = (key: string) => {
    if (!zoom.dragged()) selection.open(key);
  };
  return (
    <svg ref={zoom.wheelRef} className={styles.svg} role="group" aria-label={label} {...zoom.handlers}>
      <g transform={`translate(${x},${y}) scale(${k})`}>
        <BoxesFrames frames={layout.frames} />
        <g className={styles.edges}>
          {layout.edges.map((e) => (
            <path key={e.key} d={e.d} />
          ))}
        </g>
        {layout.boxes.map((at) => {
          const item = model.items.get(at.key);
          return (
            item && (
              <BoxRect
                key={at.key}
                at={at}
                item={item}
                fill={fills.get(at.key)}
                status={statusOf(at.key, item.group)}
                onHover={selection.hover}
                onOpen={open}
              />
            )
          );
        })}
      </g>
    </svg>
  );
}
