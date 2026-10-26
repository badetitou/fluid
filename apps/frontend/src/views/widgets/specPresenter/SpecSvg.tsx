import { useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { readRef, sanitizeSvg, type SpecHotspot } from './svgModel';
import type { SpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

interface SpecSvgProps {
  svg: string;
  hotspots?: SpecHotspot[];
  interaction: SpecInteraction;
}

/**
 * A Roassal canvas exported as SVG, sanitized and scaled to the widget width.
 * Its entities (`data-fluid-ref` elements and hotspots) emit on `selected` and
 * open in the next column, by click or Enter.
 */
export function SpecSvg({ svg, hotspots, interaction }: SpecSvgProps) {
  const navigate = useNavigate();
  const markup = useMemo(() => sanitizeSvg(svg, hotspots), [svg, hotspots]);
  if (markup === undefined) return <div className={styles.notice}>This visualization is not a valid SVG document.</div>;

  const open = (target: EventTarget) => {
    const ref = readRef(target instanceof Element ? target : null);
    if (!ref) return;
    interaction.select(ref);
    const href = interaction.hrefOf(ref);
    if (href) navigate(href);
  };
  return (
    <div
      className={styles.svg}
      onClick={(event: MouseEvent) => open(event.target)}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Enter') open(event.target);
      }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
