import { useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { groupBreaks, type MatrixCell, type MatrixGeometry } from './matrixLayout';
import type { Matrix } from './matrixModel';
import { cellOpacity, type MatrixPalette } from './matrixStyle';
import type { MatrixState } from './useMatrix';
import styles from './Matrix.module.css';

interface MatrixCellsProps {
  matrix: Matrix;
  state: MatrixState;
  geometry: MatrixGeometry;
  palette: MatrixPalette;
  onHover: (cell: MatrixCell | undefined, event: MouseEvent) => void;
}

const GRID_MIN_CELL = 6;

/** Straight lines across the grid, at the given row (horizontal) or column (vertical) indexes. */
function lines(indexes: number[], g: MatrixGeometry, rows: number, cols: number, horizontal: boolean): string {
  return indexes
    .map((k) =>
      horizontal
        ? `M${g.left},${g.top + k * g.cell}h${cols * g.cell}`
        : `M${g.left + k * g.cell},${g.top}v${rows * g.cell}`,
    )
    .join('');
}

const range = (n: number) => Array.from({ length: n + 1 }, (_, k) => k);

/** The grid: background, grid lines, greyed diagonal, group separators and the weighted cells. */
export function MatrixCells({ matrix, state, geometry: g, palette, onHover }: MatrixCellsProps) {
  const { rows, cols } = state.axes;
  const grid = useMemo(
    () => (g.cell >= GRID_MIN_CELL ? lines(range(rows.length), g, rows.length, cols.length, true) + lines(range(cols.length), g, rows.length, cols.length, false) : ''),
    [g, rows.length, cols.length],
  );
  const separators = useMemo(
    () =>
      state.sort === 'group' && matrix.groups.length > 0
        ? lines(groupBreaks(rows), g, rows.length, cols.length, true) + lines(groupBreaks(cols), g, rows.length, cols.length, false)
        : '',
    [state.sort, matrix.groups.length, rows, cols, g],
  );
  const selected = state.selection?.kind === 'cell' ? state.selection : undefined;
  const cellAt = (event: { target: EventTarget }) => {
    const index = (event.target as Element).getAttribute?.('data-cell');
    return index == null ? undefined : state.cells[Number(index)];
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const cell = cellAt(event);
    if (cell && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      state.selectCell(cell);
    }
  };

  return (
    <g
      data-part="cells"
      onMouseMove={(event) => onHover(cellAt(event), event)}
      onMouseLeave={(event) => onHover(undefined, event)}
      onClick={(event) => {
        const cell = cellAt(event);
        if (cell) state.selectCell(cell);
      }}
      onKeyDown={onKeyDown}
    >
      <rect x={g.left} y={g.top} width={cols.length * g.cell} height={rows.length * g.cell} fill={palette.background} />
      {grid && <path d={grid} stroke={palette.grid} strokeWidth={1} fill="none" />}
      {matrix.square &&
        rows.map((row, i) => (
          <rect key={row.key} x={g.left + i * g.cell} y={g.top + i * g.cell} width={g.cell} height={g.cell} fill={palette.diagonal} />
        ))}
      {separators && <path d={separators} stroke={palette.separator} strokeWidth={1} fill="none" />}
      {state.cells.map((cell, index) => {
        const isSelected = selected?.row === cell.row.key && selected.col === cell.col.key;
        return (
          <rect
            key={`${cell.row.key}\u0000${cell.col.key}`}
            data-cell={index}
            data-cycle={cell.cycle || undefined}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`${cell.row.label} → ${cell.col.label}: ${cell.weight}${cell.cycle ? ' (cycle)' : ''}`}
            className={styles.cell}
            x={g.left + cell.j * g.cell + 1}
            y={g.top + cell.i * g.cell + 1}
            width={Math.max(g.cell - 1, 1)}
            height={Math.max(g.cell - 1, 1)}
            fill={cell.cycle ? palette.cycle : palette.cell}
            fillOpacity={cellOpacity(cell.weight, matrix.max)}
            stroke={isSelected ? palette.selection : undefined}
            strokeWidth={isSelected ? 2 : undefined}
          />
        );
      })}
    </g>
  );
}
