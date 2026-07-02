import { Descriptions, Empty } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { DescriptionsWidget as DescriptionsWidgetSpec } from '@fluid/shared';
import { getPath } from '../data';
import { formatValue } from '../format';

export function DescriptionsWidget({
  widget,
  object,
}: {
  widget: DescriptionsWidgetSpec;
  object: Record<string, unknown> | null;
}) {
  if (!object) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;

  const items: DescriptionsProps['items'] = widget.items.map((item) => ({
    key: item.key,
    label: item.label,
    children: formatValue(getPath(object, item.key), item.format, { currency: item.currency }),
  }));

  return <Descriptions bordered size="small" column={widget.columns ?? 1} items={items} />;
}
