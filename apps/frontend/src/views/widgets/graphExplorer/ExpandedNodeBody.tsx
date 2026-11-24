import { useMemo } from 'react';
import { Col, Row as GridRow } from 'antd';
import type { DataBinding, Widget } from '@fluid/shared';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { nestedSpan } from '../accordion/accordionModel';
import { NestedWidget } from '../NestedWidget';
import styles from './GraphExplorer.module.css';

interface ExpandedNodeBodyProps {
  /** Nested widgets of the explorer, rendered from the node they belong to. */
  widgets: Widget[];
  /** Ids are namespaced by node so two open boxes never share an output id. */
  nodeKey: string;
  resolve: (binding: DataBinding) => unknown;
}

/** The inside of an expanded node: real fluid widgets, laid out by span in the box. */
export function ExpandedNodeBody({ widgets, nodeKey, resolve }: ExpandedNodeBodyProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const body = useMemo(
    () => widgets.map((child) => ({ ...child, id: `${nodeKey}:${child.id}` })),
    [widgets, nodeKey],
  );
  return (
    <div ref={ref} className={`${styles.detail} nodrag nowheel`}>
      {body.length === 0 ? (
        <div className={styles.group}>No detail widget declared for this node.</div>
      ) : (
        <GridRow gutter={[8, 8]}>
          {body.map((child) => (
            <Col key={child.id} span={nestedSpan(child.span, width)}>
              <NestedWidget widget={child} resolve={resolve} />
            </Col>
          ))}
        </GridRow>
      )}
    </div>
  );
}
