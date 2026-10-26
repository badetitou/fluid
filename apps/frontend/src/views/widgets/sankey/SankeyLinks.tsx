import type { PlacedLink } from './sankeyLayout';
import { formatFlow } from './sankeyModel';
import type { SankeySelection } from './useSankeySelection';
import styles from './Sankey.module.css';

interface SankeyLinksProps {
  links: PlacedLink[];
  selection: SankeySelection;
  /** Color of a ribbon: its source node's. */
  colorOf: (link: PlacedLink) => string;
}

/** The label of a ribbon: "A → B: v". */
export const linkLabel = (l: PlacedLink) => `${l.source} → ${l.target}: ${formatFlow(l.value)}`;

/** The ribbons, as thick as their flow; a ribbon going back (a cycle) is dashed. Click or Enter selects one. */
export function SankeyLinks({ links, selection, colorOf }: SankeyLinksProps) {
  return (
    <g fill="none">
      {links.map((l) => {
        const item = { kind: 'link', key: l.key } as const;
        const lit = selection.isLit(item);
        const className = [styles.link, l.back && styles.back, lit && styles.lit, selection.focusing && !lit && styles.dim]
          .filter(Boolean)
          .join(' ');
        return (
          <path
            key={l.key}
            className={className}
            d={l.path}
            stroke={colorOf(l)}
            strokeWidth={l.width}
            role="button"
            tabIndex={0}
            aria-label={l.back ? `${linkLabel(l)} (back, closes a cycle)` : linkLabel(l)}
            aria-pressed={selection.selected?.kind === 'link' && selection.selected.key === l.key}
            onMouseEnter={() => selection.hover(item)}
            onMouseLeave={() => selection.hover(undefined)}
            onFocus={() => selection.hover(item)}
            onBlur={() => selection.hover(undefined)}
            onClick={() => selection.choose(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') selection.choose(item);
            }}
          />
        );
      })}
    </g>
  );
}
