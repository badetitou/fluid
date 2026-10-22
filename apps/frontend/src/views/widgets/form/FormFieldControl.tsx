import { Form, Input, InputNumber, Select, Switch } from 'antd';
import type { FormField } from '@fluid/shared';
import { humanize } from '../../fieldHeuristics';

interface FormFieldControlProps {
  field: FormField;
  disabled: boolean;
}

/** One field of the form widget: its label and the control matching its input kind. */
export function FormFieldControl({ field, disabled }: FormFieldControlProps) {
  const label = field.label ?? humanize(field.key.split('.').pop()!);
  const boolean = field.input === 'boolean';
  return (
    <Form.Item
      name={field.key}
      label={label}
      valuePropName={boolean ? 'checked' : 'value'}
      rules={field.required ? [{ required: true, message: `${label} is required` }] : undefined}
    >
      {control(field, disabled)}
    </Form.Item>
  );
}

function control(field: FormField, disabled: boolean) {
  switch (field.input) {
    case 'boolean':
      return <Switch disabled={disabled} />;
    case 'number':
      return <InputNumber disabled={disabled} style={{ width: '100%' }} />;
    case 'textarea':
      return <Input.TextArea disabled={disabled} autoSize={{ minRows: 2, maxRows: 8 }} />;
    case 'date':
      // A plain date input keeps the value an ISO string, as GraphQL expects it.
      return <Input type="date" disabled={disabled} />;
    case 'select':
      return <Select disabled={disabled} options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />;
    default:
      return <Input disabled={disabled} />;
  }
}
