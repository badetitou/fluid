import { useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { ZoomCanvas } from '../zoom/ZoomCanvas';
import { READABLE_K } from '../zoom/useZoomPan';
import { frameHeight, readRef, sanitizeSvg, type SpecHotspot } from './svgModel';
import type { SpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

interface SpecSvgProps {
  svg: string;
  hotspots?: SpecHotspot[];
  interaction: SpecInteraction;
}

/**
 * A Roassal canvas exported as SVG, sanitized, zoomable and pannable, first
 * shown across the widget width. Its entities (`data-fluid-ref` elements and
 * hotspots) emit on `selected` and open in the next column, by click or Enter.
 */
export function SpecSvg({ svg, hotspots, interaction }: SpecSvgProps) {
  const navigate = useNavigate();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const drawing = useMemo(() => sanitizeSvg(svg, hotspots), [svg, hotspots]);
  if (drawing === undefined) return <div className={styles.notice}>This visualization is not a valid SVG document.</div>;

  const open = (target: EventTarget) => {
    const entity = readRef(target instanceof Element ? target : null);
    if (!entity) return;
    interaction.select(entity);
    const href = interaction.hrefOf(entity);
    if (href) navigate(href);
  };
  return (
    <div
      ref={ref}
      className={styles.svg}
      onClick={(event: MouseEvent) => open(event.target)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Enter') open(event.target);
      }}
    >
      <ZoomCanvas content={drawing} height={frameHeight(drawing, Math.floor(width), READABLE_K)} label="Visualization">
        <g dangerouslySetInnerHTML={{ __html: drawing.markup }} />
      </ZoomCanvas>
    </div>
  );
}
