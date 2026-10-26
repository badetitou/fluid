import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MatrixSort, MatrixWidget } from '@fluid/shared';
import { useLinkHref } from '../useCellRenderer';
import { cellsOf, defaultSort, orderAxes, type MatrixAxes, type MatrixCell } from './matrixLayout';
import type { Matrix, MatrixItem } from './matrixModel';

export type MatrixAxis = 'row' | 'col';

/** What the user last clicked: a cell, or a label of one of the axes. */
export type MatrixSelection = { kind: 'cell'; row: string; col: string } | { kind: MatrixAxis; key: string };

/** The cell under the pointer, and where to show its tooltip (in the frame). */
export interface MatrixHover {
  cell: MatrixCell;
  x: number;
  y: number;
}

export interface MatrixState {
  sort: MatrixSort;
  setSort: (sort: MatrixSort) => void;
  axes: MatrixAxes;
  cells: MatrixCell[];
  hover?: MatrixHover;
  setHover: (hover: MatrixHover | undefined) => void;
  selection?: MatrixSelection;
  /** Selects a cell: emits `{ source, target, weight }` on `selected`. */
  selectCell: (cell: MatrixCell) => void;
  /** Selects a label: emits its row on `selected` and opens it in a new column. */
  openLabel: (axis: MatrixAxis, item: MatrixItem) => void;
}

/** The order of the axes, the hovered and the selected cell, and what clicking does. */
export function useMatrix(
  widget: MatrixWidget,
  matrix: Matrix,
  emit: (port: string, value: unknown) => void,
): MatrixState {
  const [sort, setSort] = useState<MatrixSort>(() => defaultSort(widget.sort, widget.groupField));
  const [hover, setHover] = useState<MatrixHover>();
  const [selection, setSelection] = useState<MatrixSelection>();
  const navigate = useNavigate();
  const hrefOf = useLinkHref();
  const axes = useMemo(() => orderAxes(matrix, sort), [matrix, sort]);
  const cells = useMemo(() => cellsOf(matrix, axes), [matrix, axes]);

  const selectCell = useCallback(
    (cell: MatrixCell) => {
      setSelection({ kind: 'cell', row: cell.row.key, col: cell.col.key });
      emit('selected', { source: cell.row.row, target: cell.col.row, weight: cell.weight });
    },
    [emit],
  );
  const openLabel = useCallback(
    (axis: MatrixAxis, item: MatrixItem) => {
      setSelection({ kind: axis, key: item.key });
      emit('selected', item.row);
      const href = hrefOf(item.row, axis === 'row' || matrix.square ? widget.linkTo : widget.targetLinkTo);
      if (href) navigate(href);
    },
    [emit, hrefOf, matrix.square, widget.linkTo, widget.targetLinkTo, navigate],
  );

  return { sort, setSort, axes, cells, hover, setHover, selection, selectCell, openLabel };
}
