import { useMemo, useState } from 'react';
import { Collapse, Empty, Pagination } from 'antd';
import type { AccordionWidget as AccordionWidgetSpec, DataBinding } from '@fluid/shared';
import { buildPanels, DEFAULT_PAGE_SIZE, initialOpenKeys, pageOf } from './accordionModel';
import { AccordionHeader } from './AccordionHeader';
import { AccordionPanelBody, type NestedWidgetRenderer } from './AccordionPanelBody';
import styles from './Accordion.module.css';

interface AccordionWidgetProps {
  widget: AccordionWidgetSpec;
  data: unknown;
  resolve: (binding: DataBinding) => unknown;
  Nested: NestedWidgetRenderer;
}

/**
 * A collection as folding panels. A panel's widgets are only rendered once it
 * is unfolded, so long collections of heavy details (source code…) stay cheap.
 */
export function AccordionWidget({ widget, data, resolve, Nested }: AccordionWidgetProps) {
  const panels = useMemo(() => buildPanels(data, widget.keyField, widget.labelField), [data, widget.keyField, widget.labelField]);
  const [openKeys, setOpenKeys] = useState<string[]>(() => initialOpenKeys(panels, widget.expanded));
  const [page, setPage] = useState(1);
  const pageSize = widget.pageSize ?? DEFAULT_PAGE_SIZE;

  if (panels.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;

  const items = pageOf(panels, page, pageSize).map((panel) => ({
    key: panel.key,
    label: <AccordionHeader label={panel.label} row={panel.row} summary={widget.summary} />,
    children: <AccordionPanelBody widgets={widget.widgets} row={panel.row} resolve={resolve} Nested={Nested} />,
  }));

  return (
    <>
      <Collapse
        size="small"
        accordion={widget.single}
        activeKey={openKeys}
        onChange={(keys) => setOpenKeys(Array.isArray(keys) ? keys : [keys])}
        items={items}
      />
      {panels.length > pageSize && (
        <Pagination
          className={styles.pager}
          size="small"
          align="end"
          current={page}
          pageSize={pageSize}
          total={panels.length}
          showSizeChanger={false}
          onChange={setPage}
        />
      )}
    </>
  );
}
