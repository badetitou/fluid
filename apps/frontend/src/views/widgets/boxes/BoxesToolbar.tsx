import { Button, Select } from 'antd';
import type { BoxesWidget } from '@fluid/shared';
import { metricLabel } from './boxesMetrics';
import styles from './Boxes.module.css';
import type { BoxesConfig } from './useBoxesConfig';

interface BoxesToolbarProps {
  widget: BoxesWidget;
  config: BoxesConfig;
}

const NONE = '';
const METRICS = [
  ['widthField', 'Width'],
  ['heightField', 'Height'],
  ['colorField', 'Color'],
] as const;
const LAYOUTS = [
  ['', 'Auto'],
  ['tree', 'Tree'],
  ['flow', 'Flow'],
  ['treemap', 'Treemap'],
] as const;

/** Lets the reader remap width, height, color and layout without editing the view. */
export function BoxesToolbar({ widget, config }: BoxesToolbarProps) {
  const metricOptions = [
    { value: NONE, label: 'None' },
    ...config.fields.map((field) => ({ value: field, label: metricLabel(field) })),
  ];
  const layout: string = config.overrides.boxLayout ?? widget.boxLayout ?? (widget.parentField ? 'tree' : 'flow');
  return (
    <div className={styles.toolbar}>
      {METRICS.map(([key, label]) => (
        <label key={key} className={styles.control}>
          {label}
          <Select
            size="small"
            className={styles.picker}
            options={metricOptions}
            value={config.overrides[key] ?? widget[key] ?? NONE}
            onChange={(value) => config.set(key, value === NONE ? null : value)}
          />
        </label>
      ))}
      <label className={styles.control}>
        Layout
        <Select
          size="small"
          className={styles.picker}
          value={layout}
          options={LAYOUTS.map(([value, label]) => ({
            value,
            label,
            disabled: value === 'tree' && !widget.parentField,
          }))}
          onChange={(value) => config.set('boxLayout', value === NONE ? null : value)}
        />
      </label>
      <span className={styles.spacer} />
      {Object.values(config.overrides).some((value) => value !== undefined) && (
        <Button type="link" size="small" onClick={config.reset}>
          Reset
        </Button>
      )}
    </div>
  );
}
