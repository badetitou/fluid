import { Select } from 'antd';
import type { MatrixSort } from '@fluid/shared';
import { countCycles, type Matrix } from './matrixModel';
import { MatrixLegend } from './MatrixLegend';
import type { MatrixState } from './useMatrix';
import styles from './Matrix.module.css';

interface MatrixToolbarProps {
  matrix: Matrix;
  state: MatrixState;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The order of the axes, the legend of the colors, and how many dependencies and cycles there are. */
export function MatrixToolbar({ matrix, state }: MatrixToolbarProps) {
  const cycles = matrix.square ? countCycles(matrix) : 0;
  const options: { value: MatrixSort; label: string; disabled?: boolean }[] = [
    { value: 'original', label: 'Original order' },
    { value: 'name', label: 'By name' },
    { value: 'group', label: 'By group', disabled: matrix.groups.length === 0 },
    { value: 'weight', label: 'By total weight' },
  ];
  return (
    <div className={styles.toolbar}>
      <Select
        className={styles.sort}
        size="small"
        aria-label="Order of the axes"
        options={options}
        value={state.sort}
        onChange={state.setSort}
      />
      <MatrixLegend max={matrix.max} cycles={matrix.square} />
      <span className={styles.spacer} />
      <span className={styles.count}>
        {matrix.rows.length} × {matrix.cols.length} · {matrix.links} {matrix.links === 1 ? 'dependency' : 'dependencies'}
        {matrix.square && ` · ${plural(cycles, 'cycle')}`}
      </span>
    </div>
  );
}
