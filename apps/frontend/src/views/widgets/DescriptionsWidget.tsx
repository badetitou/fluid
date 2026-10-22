import { Descriptions, Empty } from 'antd';
import type { DescriptionsProps } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { DescriptionsWidget as DescriptionsWidgetSpec } from '@fluid/shared';
import { getPath } from '../data';
import { formatValue } from '../format';
import { useLinkHref } from '../../navigation/columnPath';

export function DescriptionsWidget({
  widget,
  object,
}: {
  widget: DescriptionsWidgetSpec;
  object: Record<string, unknown> | null;
}) {
  const navigate = useNavigate();
  const hrefOf = useLinkHref();

  if (!object) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />;

  const items: DescriptionsProps['items'] = widget.items.map((item) => {
    const value = getPath(object, item.key);
    const formatted = formatValue(value, item.format, { currency: item.currency });

    // An item with a linkTo config renders as a link (to the concrete type of an interface).
    const href = hrefOf(object, item.linkTo);
    if (href) {
      return {
        key: item.key,
        label: item.label,
        children: (
          <a onClick={() => navigate(href)} style={{ cursor: 'pointer' }}>
            {formatted} <RightOutlined style={{ fontSize: 10 }} />
          </a>
        ),
      };
    }

    return {
      key: item.key,
      label: item.label,
      children: formatted,
    };
  });

  return <Descriptions bordered size="small" column={widget.columns ?? 1} items={items} />;
}
