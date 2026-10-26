import type { KeyboardEvent } from 'react';
import { truncate, type MatrixGeometry } from './matrixLayout';
import type { Matrix, MatrixItem } from './matrixModel';
import { bandColor, type MatrixPalette } from './matrixStyle';
import type { MatrixAxis, MatrixState } from './useMatrix';
import styles from './Matrix.module.css';

interface MatrixAxisLabelsProps {
  axis: MatrixAxis;
  matrix: Matrix;
  state: MatrixState;
  geometry: MatrixGeometry;
  palette: MatrixPalette;
}

const GAP = 4;

/** Whether an item of the axis is the selected label, or in the selected or hovered cell. */
function isActive(state: MatrixState, axis: MatrixAxis, key: string): boolean {
  const { selection, hover } = state;
  const inCell = (cell: { row: string; col: string }) => (axis === 'row' ? cell.row : cell.col) === key;
  if (hover && inCell({ row: hover.cell.row.key, col: hover.cell.col.key })) return true;
  if (!selection) return false;
  return selection.kind === 'cell' ? inCell(selection) : selection.kind === axis && selection.key === key;
}

/**
 * The labels of one axis: row labels on the left, column labels on top (vertical),
 * each with its group band. A label is a button: it opens its element. When the
 * cells are too small to write labels, their hit areas remain, with a tooltip.
 */
export function MatrixAxisLabels({ axis, matrix, state, geometry: g, palette }: MatrixAxisLabelsProps) {
  const items = axis === 'row' ? state.axes.rows : state.axes.cols;
  const depth = (axis === 'row' ? g.left : g.top) - g.band;
  const onKeyDown = (event: KeyboardEvent, item: MatrixItem) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    state.openLabel(axis, item);
  };

  return (
    <g data-part={`${axis}-labels`}>
      {items.map((item, k) => {
        const offset = (axis === 'row' ? g.top : g.left) + k * g.cell;
        const band = item.group !== undefined && g.band > 0 && (
          <rect
            x={axis === 'row' ? depth : 0}
            y={axis === 'row' ? 0 : depth}
            width={axis === 'row' ? g.band - 1 : g.cell}
            height={axis === 'row' ? g.cell : g.band - 1}
            fill={bandColor(matrix.groups, item.group, palette)}
          />
        );
        return (
          <g
            key={item.key}
            role="button"
            tabIndex={0}
            aria-label={axis === 'col' && matrix.square ? `${item.label} (column)` : item.label}
            data-active={isActive(state, axis, item.key) || undefined}
            className={styles.label}
            transform={axis === 'row' ? `translate(0,${offset})` : `translate(${offset},0)`}
            onClick={() => state.openLabel(axis, item)}
            onKeyDown={(event) => onKeyDown(event, item)}
          >
            <title>{item.group === undefined ? item.label : `${item.label} (${item.group})`}</title>
            <rect className={styles.hit} width={axis === 'row' ? depth : g.cell} height={axis === 'row' ? g.cell : depth} />
            {g.labels && (
              <text
                transform={axis === 'row' ? `translate(${depth - GAP},${g.cell / 2})` : `translate(${g.cell / 2},${depth - GAP}) rotate(-90)`}
                textAnchor={axis === 'row' ? 'end' : 'start'}
                dominantBaseline="central"
                fontSize={g.fontSize}
              >
                {truncate(item.label)}
              </text>
            )}
            {band}
          </g>
        );
      })}
    </g>
  );
}
