import { Form, Input, InputNumber, Select } from 'antd';
import type { OptionField } from './options';
import { PathInput } from './PathInput';
import type { OptionSuggestions } from './useWidgetBuilder';
import styles from './WidgetBuilder.module.css';

interface OptionItemProps {
  field: OptionField;
  suggestions: OptionSuggestions;
  error?: string;
}

const BOOLEAN_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const toOptions = (values: (string | number)[]) => values.map((value) => ({ value, label: String(value) }));

// A plain function, not a component: Form.Item hands its value to its direct child.
function control(field: OptionField, suggestions: OptionSuggestions) {
  switch (field.kind) {
    case 'query':
      return <Select options={toOptions(suggestions.queries)} />;
    case 'path':
      return <PathInput mode="path" suggestions={suggestions.paths} />;
    case 'field':
      return <PathInput mode="field" base={suggestions.rowsPath} suggestions={suggestions.fields} />;
    case 'number':
      return <InputNumber min={field.min} max={field.max} className={styles.number} />;
    case 'boolean':
      // Unset is not "off": an omitted flag takes the widget's own default.
      return <Select allowClear options={BOOLEAN_OPTIONS} placeholder="Default" />;
    case 'select':
      return <Select allowClear options={toOptions(field.choices ?? [])} placeholder="Default" />;
    case 'json':
      return <Input.TextArea autoSize={{ minRows: 2, maxRows: 10 }} className={styles.json} placeholder="JSON" />;
    default:
      return <Input allowClear />;
  }
}

/** One option of the selected widget, with the editor its schema calls for. */
export function OptionItem({ field, suggestions, error }: OptionItemProps) {
  return (
    <Form.Item
      name={field.key}
      label={field.label}
      required={field.required}
      validateStatus={error ? 'error' : undefined}
      help={error}
      className={styles.option}
    >
      {control(field, suggestions)}
    </Form.Item>
  );
}
