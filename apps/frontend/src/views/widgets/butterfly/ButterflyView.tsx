import { useMemo } from 'react';
import type { ButterflyWidget } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import { CENTER_ID, tooltipOf, type Butterfly } from './butterflyModel';
import { layoutButterfly } from './butterflyLayout';
import { accentColors, butterflyPalette, paletteVariables } from './butterflyStyle';
import { ButterflyBox } from './ButterflyBox';
import { ButterflyEdges } from './ButterflyEdges';
import { ButterflyHeader } from './ButterflyHeader';
import { ZoomCanvas } from '../zoom/ZoomCanvas';
import { useButterfly } from './useButterfly';
import styles from './Butterfly.module.css';

interface ButterflyViewProps {
  widget: ButterflyWidget;
  butterfly: Butterfly;
  emit: (port: string, value: unknown) => void;
  /** Height of the whole widget: header and map. */
  height: number;
}

const HEADER_HEIGHT = 28;

/** The laid out butterfly map, sized to the measured width, zoomable and pannable, with its counters. */
export function ButterflyView({ widget, butterfly, emit, height }: ButterflyViewProps) {
  const theme = useWidgetTheme(widget.type);
  const palette = useMemo(() => butterflyPalette(theme), [theme]);
  const accents = useMemo(() => accentColors(butterfly, palette), [butterfly, palette]);
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const layout = useMemo(() => layoutButterfly(butterfly, Math.floor(width)), [butterfly, width]);
  const state = useButterfly(widget, butterfly, emit);
  const center = layout.boxes.get(CENTER_ID);

  return (
    <div ref={ref} className={styles.root} style={paletteVariables(palette)}>
      <ButterflyHeader butterfly={butterfly} groupField={widget.groupField} />
      <ZoomCanvas
        content={layout}
        height={Math.max(height - HEADER_HEIGHT, 120)}
        label={widget.title ?? `Dependencies of ${butterfly.center.label}`}
      >
        {width > 0 && (
          <>
            <ButterflyEdges edges={layout.edges} lit={state.lit} />
            {center && (
              <ButterflyBox
                box={center}
                label={butterfly.center.label}
                tooltip={butterfly.center.label}
                accent={accents.get(CENTER_ID)}
                maxChars={layout.maxChars}
                state={state}
                kind="center"
              />
            )}
            {butterfly.nodes.map((node) => {
              const box = layout.boxes.get(node.id);
              return box ? (
                <ButterflyBox
                  key={node.id}
                  box={box}
                  label={node.label}
                  tooltip={tooltipOf(node)}
                  accent={accents.get(node.id)}
                  maxChars={layout.maxChars}
                  state={state}
                  kind={node.row ? 'node' : 'group'}
                />
              ) : null;
            })}
          </>
        )}
      </ZoomCanvas>
    </div>
  );
}
