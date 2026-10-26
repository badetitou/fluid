import { useMemo } from 'react';
import type { BlueprintWidget } from '@fluid/shared';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import type { Blueprint } from './blueprintModel';
import { layoutBlueprint } from './blueprintLayout';
import { blueprintPalette, paletteVariables } from './blueprintStyle';
import { BlueprintBox } from './BlueprintBox';
import { BlueprintColumns } from './BlueprintColumns';
import { BlueprintEdges } from './BlueprintEdges';
import { BlueprintLegend } from './BlueprintLegend';
import { ZoomCanvas } from '../zoom/ZoomCanvas';
import { useBlueprint } from './useBlueprint';
import styles from './Blueprint.module.css';

interface BlueprintViewProps {
  widget: BlueprintWidget;
  blueprint: Blueprint;
  emit: (port: string, value: unknown) => void;
  /** Height of the whole widget: legend and drawing. */
  height: number;
}

const LEGEND_HEIGHT = 26;
const MIN_HEIGHT = 140;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The laid out blueprint (layer columns, arrows, boxes), zoomable and pannable, and the legend above. */
export function BlueprintView({ widget, blueprint, emit, height }: BlueprintViewProps) {
  const theme = useWidgetTheme(widget.type);
  const palette = useMemo(() => blueprintPalette(theme), [theme]);
  const layout = useMemo(() => layoutBlueprint(blueprint), [blueprint]);
  const kinds = useMemo(() => new Set(layout.boxes.map((b) => b.kind)), [layout]);
  const state = useBlueprint(widget, blueprint, emit);
  const summary = `${plural(blueprint.methods.length, 'method')}, ${plural(blueprint.attributes.length, 'attribute')}`;

  return (
    <div className={styles.frame} style={paletteVariables(palette)}>
      <BlueprintLegend kinds={kinds} summary={summary} />
      <ZoomCanvas
        content={layout}
        height={Math.max(MIN_HEIGHT, height - LEGEND_HEIGHT)}
        label={widget.title ?? 'Class blueprint'}
      >
        <g className={styles.drawing}>
          <BlueprintColumns columns={layout.columns} height={layout.height} />
          <BlueprintEdges edges={layout.edges} hovered={state.hovered} />
          {layout.boxes.map((box) => (
            <BlueprintBox key={box.key} box={box} state={state} />
          ))}
        </g>
      </ZoomCanvas>
    </div>
  );
}
