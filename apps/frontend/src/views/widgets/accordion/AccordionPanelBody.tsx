import { useMemo, type ComponentType } from 'react';
import { Col, Row as GridRow } from 'antd';
import type { DataBinding, Widget } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { itemResolver, nestedSpan, type Row } from './accordionModel';
import styles from './Accordion.module.css';

/** Renders one nested widget from a resolver (provided by the catalog, which knows every widget type). */
export type NestedWidgetRenderer = ComponentType<{ widget: Widget; resolve: (binding: DataBinding) => unknown }>;

interface AccordionPanelBodyProps {
  widgets: Widget[];
  row: Row;
  resolve: (binding: DataBinding) => unknown;
  Nested: NestedWidgetRenderer;
}

/** An unfolded panel: its widgets laid out by `span` (relative to the panel's width), bound to the panel's element through `$item`. */
export function AccordionPanelBody({ widgets, row, resolve, Nested }: AccordionPanelBodyProps) {
  const resolveItem = useMemo(() => itemResolver(row, resolve), [row, resolve]);
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return (
    <div ref={ref}>
      <GridRow gutter={[12, 12]}>
        {widgets.map((child) => (
          <Col key={child.id} span={nestedSpan(child.span, width)}>
            {child.title && <div className={styles.nestedTitle}>{child.title}</div>}
            <Nested widget={child} resolve={resolveItem} />
          </Col>
        ))}
      </GridRow>
    </div>
  );
}
