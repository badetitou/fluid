import { Descriptions, Empty } from 'antd';
import type { DescriptionsProps } from 'antd';
import { Link } from 'react-router-dom';
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

  const items: DescriptionsProps['items'] = widget.items.map((item) => {
    const value = getPath(object, item.key);
    const formatted = formatValue(value, item.format, { currency: item.currency });

    // If the item has a linkTo config, render as a link
    if (item.linkTo) {
      const idValue = getPath(object, item.linkTo.idField ?? 'id');
      if (idValue) {
        return {
          key: item.key,
          label: item.label,
          children: (
            <Link to={`/concept/${item.linkTo.concept}/item/${idValue}`}>
              {formatted}
            </Link>
          ),
        };
      }
    }

    return {
      key: item.key,
      label: item.label,
      children: formatted,
    };
  });

  return <Descriptions bordered size="small" column={widget.columns ?? 1} items={items} />;
}
