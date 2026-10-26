import { useMemo, type CSSProperties } from 'react';
import { Empty } from 'antd';
import type { SpecPresenterWidget as SpecPresenterWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import { parseSpecNode } from './model';
import { SpecNodeView } from './SpecNodeView';
import { useSpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

type SpecPresenterWidgetProps = Pick<WidgetProps<SpecPresenterWidgetSpec>, 'widget' | 'data' | 'emit' | 'fitHeight'>;

/**
 * A Pharo inspector tab served by Spec-Fluid: tables, trees, Roassal SVG, text
 * and their composites. Entities open in the next column and are emitted on
 * `selected` as `{ id, type? }`.
 *
 * Colors come from the theme; a theme may set, under `widgets.specPresenter`:
 * `mutedColor`, `selectionColor`, `textBackground`.
 */
export function SpecPresenterWidget({ widget, data, emit, fitHeight }: SpecPresenterWidgetProps) {
  const theme = useWidgetTheme(widget.type);
  const parsed = useMemo(() => parseSpecNode(data), [data]);
  const interaction = useSpecInteraction(emit);
  const frame = {
    '--spec-muted': theme.vars.mutedColor ?? theme.inkMuted,
    '--spec-selection': theme.vars.selectionColor ?? theme.primary,
    '--spec-selected-bg': theme.selected,
    '--spec-text-bg': theme.vars.textBackground ?? theme.surfaceElevated,
    '--spec-border': theme.borderSubtle,
    maxHeight: fitHeight ?? widget.maxHeight,
  } as CSSProperties;

  return (
    <div className={styles.frame} style={frame}>
      {parsed.node ? (
        <SpecNodeView node={parsed.node} interaction={interaction} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={parsed.reason} />
      )}
    </div>
  );
}
