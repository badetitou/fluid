import type { CSSProperties } from 'react';
import { Empty } from 'antd';
import type { SpecPresenterWidget as SpecPresenterWidgetSpec } from '@fluid/shared';
import type { WidgetProps } from '../../plugin-api/types';
import { useWidgetTheme } from '../../plugin-api/widgetTheme';
import { useSpecEnv } from './specEnv';
import { SpecNodeView } from './SpecNodeView';
import { SpecViewActions } from './SpecViewActions';
import { useOpenViewDocument } from './useOpenViewDocument';
import { useOpenViewSource } from './useOpenViewSource';
import { useSpecInteraction } from './useSpecInteraction';
import styles from './SpecPresenter.module.css';

type SpecPresenterWidgetProps = Pick<WidgetProps<SpecPresenterWidgetSpec>, 'widget' | 'data' | 'emit' | 'fitHeight'>;

/**
 * A view served by a tool in the fluid Open Views format: lists, tables,
 * trees, SVG, text, tabs and their composites, with the view's actions as buttons. Items announced but not sent
 * are loaded from the widget's data source. Entities open in the next column
 * and are emitted on `selected` as `{ id, type? }`.
 *
 * Colors come from the theme; a theme may set, under `widgets.specPresenter`:
 * `mutedColor`, `selectionColor`, `textBackground`, `highlightColor` (selected part of a text).
 */
export function SpecPresenterWidget({ widget, data, emit, fitHeight }: SpecPresenterWidgetProps) {
  const theme = useWidgetTheme(widget.type);
  const source = useOpenViewSource(widget.data);
  const { parsed, reload } = useOpenViewDocument(widget.data, data, source);
  const interaction = useSpecInteraction(emit);
  const env = useSpecEnv(parsed.doc?.node, interaction, source);
  const frame = {
    '--spec-muted': theme.vars.mutedColor ?? theme.inkMuted,
    '--spec-selection': theme.vars.selectionColor ?? theme.primary,
    '--spec-selected-bg': theme.selected,
    '--spec-text-bg': theme.vars.textBackground ?? theme.surfaceElevated,
    '--spec-highlight': theme.vars.highlightColor ?? theme.selected,
    '--spec-border': theme.borderSubtle,
    maxHeight: fitHeight ?? widget.maxHeight,
  } as CSSProperties;

  return (
    <div className={styles.frame} style={frame}>
      {parsed.doc ? (
        <>
          <SpecViewActions actions={parsed.doc.actions} source={source} interaction={interaction} reload={reload} />
          <SpecNodeView node={parsed.doc.node} env={env} />
        </>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={parsed.reason} />
      )}
    </div>
  );
}
