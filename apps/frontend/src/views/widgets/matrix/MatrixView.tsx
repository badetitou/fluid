import { useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { theme as antdTheme } from 'antd';
import type { MatrixWidget } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import type { MatrixCell } from './matrixLayout';
import { layoutMatrix } from './matrixLayout';
import type { Matrix } from './matrixModel';
import { matrixPalette, paletteVariables } from './matrixStyle';
import { MatrixAxisLabels } from './MatrixAxisLabels';
import { MatrixCells } from './MatrixCells';
import { MatrixToolbar } from './MatrixToolbar';
import { MatrixTooltip } from './MatrixTooltip';
import { ZoomCanvas } from '../zoom/ZoomCanvas';
import { useMatrix } from './useMatrix';
import styles from './Matrix.module.css';

interface MatrixViewProps {
  widget: MatrixWidget;
  matrix: Matrix;
  emit: (port: string, value: unknown) => void;
  /** Height of the whole widget: toolbar and grid. */
  height: number;
}

/** The matrix with its toolbar (order, legend), sized to the width of its column, zoomable and pannable. */
export function MatrixView({ widget, matrix, emit, height }: MatrixViewProps) {
  const theme = useWidgetTheme(widget.type);
  const { token } = antdTheme.useToken();
  const palette = useMemo(() => matrixPalette(theme, token.colorError), [theme, token.colorError]);
  const state = useMatrix(widget, matrix, emit);
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const frame = useRef<HTMLDivElement | null>(null);
  const frameRef = useCallback(
    (el: HTMLDivElement | null) => {
      frame.current = el;
      measure(el);
    },
    [measure],
  );
  const geometry = useMemo(
    () => layoutMatrix(state.axes, width, matrix.groups.length > 0),
    [state.axes, width, matrix.groups.length],
  );
  const { setHover } = state;
  const onHover = useCallback(
    (cell: MatrixCell | undefined, event: MouseEvent) => {
      const box = frame.current?.getBoundingClientRect();
      setHover(cell && box ? { cell, x: event.clientX - box.left, y: event.clientY - box.top } : undefined);
    },
    [setHover],
  );

  return (
    <div ref={frameRef} className={styles.frame} style={{ ...paletteVariables(palette), height }}>
      <MatrixToolbar matrix={matrix} state={state} />
      <ZoomCanvas content={geometry} label={widget.title ?? 'Dependency matrix'} className={styles.canvas}>
          <MatrixCells matrix={matrix} state={state} geometry={geometry} palette={palette} onHover={onHover} />
          <MatrixAxisLabels axis="row" matrix={matrix} state={state} geometry={geometry} palette={palette} />
          <MatrixAxisLabels axis="col" matrix={matrix} state={state} geometry={geometry} palette={palette} />
      </ZoomCanvas>
      {state.hover && <MatrixTooltip hover={state.hover} />}
    </div>
  );
}
