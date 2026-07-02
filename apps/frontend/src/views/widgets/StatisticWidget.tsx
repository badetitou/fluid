import { Statistic } from 'antd';
import type { StatisticWidget as StatisticWidgetSpec } from '@fluid/shared';
import { aggregate } from '../data';
import { formatCurrency } from '../format';

export function StatisticWidget({ widget, data }: { widget: StatisticWidgetSpec; data: unknown }) {
  const raw = aggregate(data, widget.value.op, widget.value.field);
  const value: string | number = raw == null ? '—' : raw;

  const isCurrency = widget.format === 'currency' && typeof raw === 'number';

  return (
    <Statistic
      value={value}
      precision={isCurrency ? undefined : widget.precision}
      prefix={widget.prefix}
      suffix={widget.suffix ?? (widget.format === 'percent' ? '%' : undefined)}
      formatter={isCurrency ? () => formatCurrency(raw, widget.currency) : undefined}
    />
  );
}
