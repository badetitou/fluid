import { Descriptions, Empty } from 'antd';
import type { DescriptionsProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DescriptionsWidget as DescriptionsWidgetSpec } from '@fluid/shared';
import { getPath } from '../data';
import { formatValue } from '../format';
import { getNavigationId } from '../../navigation/linkExtractor';

export function DescriptionsWidget({
  widget,
  object,
}: {
  widget: DescriptionsWidgetSpec;
  object: Record<string, unknown> | null;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  
  if (!object) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;

  const items: DescriptionsProps['items'] = widget.items.map((item) => {
    const value = getPath(object, item.key);
    const formatted = formatValue(value, item.format, { currency: item.currency });

    // If the item has a linkTo config, render as a link
    if (item.linkTo) {
      const idFieldPath = item.linkTo.idField ?? 'id';
      const idValue = getNavigationId(object, idFieldPath);
      
      if (idValue) {
        // Always in Miller view: append to the current path
        const href = `${location.pathname}/${item.linkTo.concept}/${idValue}`;

        return {
          key: item.key,
          label: item.label,
          children: (
            <a onClick={() => navigate(href)} style={{ cursor: 'pointer' }}>
              {formatted}
            </a>
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
