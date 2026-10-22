import { useMemo, useState } from 'react';
import { Alert, Button, Collapse, Form, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons';
import type { CoreWidget, Widget } from '@fluid/shared';
import { WIDGET_INFO } from '../../views/widgets/widgetInfo';
import { OptionItem } from './OptionItem';
import { fromFormValues, toFormValues, widgetOptions, type OptionField, type OptionValues } from './options';
import type { OptionSuggestions } from './useWidgetBuilder';
import styles from './WidgetBuilder.module.css';

interface WidgetInspectorProps {
  widget: CoreWidget;
  suggestions: OptionSuggestions;
  /** Receives the widget each time its options form a valid widget. */
  onChange: (widget: Widget) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * The options of the selected widget, as a form generated from its schema.
 * Edits apply to the view as soon as they make a valid widget; until then the
 * offending options show why.
 */
export function WidgetInspector({ widget, suggestions, onChange, onRemove, onClose }: WidgetInspectorProps) {
  const fields = widgetOptions(widget.type);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The form keeps what is typed; it is seeded once per widget (the inspector is keyed by id).
  const [initialValues] = useState(() => toFormValues(widget, fields));
  const info = WIDGET_INFO[widget.type];

  const { data, main, advanced } = useMemo(() => {
    const own = fields.filter((f) => !f.key.startsWith('data.'));
    return {
      data: fields.filter((f) => f.key.startsWith('data.')),
      main: own.filter((f) => f.kind !== 'json'),
      advanced: own.filter((f) => f.kind === 'json'),
    };
  }, [fields]);

  const onValuesChange = (_: OptionValues, all: OptionValues) => {
    const result = fromFormValues(widget, all, fields);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) onChange(result.widget);
  };

  const items = (list: OptionField[]) =>
    list.map((f) => <OptionItem key={f.key} field={f} suggestions={suggestions} error={errors[f.key]} />);

  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorHeader}>
        <Tooltip title="Back to the catalog">
          <Button type="text" size="small" aria-label="Back to the catalog" icon={<ArrowLeftOutlined />} onClick={onClose} />
        </Tooltip>
        <span className={styles.entryIcon}>{info.icon}</span>
        <Typography.Text strong ellipsis className={styles.grow}>
          {info.label}
        </Typography.Text>
        <Tooltip title="Remove widget">
          <Button type="text" size="small" danger aria-label="Remove widget" icon={<DeleteOutlined />} onClick={onRemove} />
        </Tooltip>
      </div>
      {errors[''] && <Alert type="error" showIcon title={errors['']} />}
      <Form layout="vertical" size="small" initialValues={initialValues} onValuesChange={onValuesChange}>
        <Typography.Text type="secondary" className={styles.groupTitle}>
          Data
        </Typography.Text>
        {items(data)}
        <Typography.Text type="secondary" className={styles.groupTitle}>
          Options
        </Typography.Text>
        {items(main)}
        {advanced.length > 0 && (
          <Collapse
            ghost
            size="small"
            items={[{ key: 'advanced', label: 'Advanced (JSON)', children: items(advanced), forceRender: true }]}
          />
        )}
      </Form>
    </div>
  );
}
