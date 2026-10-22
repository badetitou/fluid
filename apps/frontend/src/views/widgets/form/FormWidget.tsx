import { Alert, Button, Empty, Form, Skeleton } from 'antd';
import type { FormWidget as FormWidgetSpec } from '@fluid/shared';
import type { InvokeAction } from '../../plugin-api';
import { FormFieldControl } from './FormFieldControl';
import { useFormWidget } from './useFormWidget';

interface FormWidgetProps {
  widget: FormWidgetSpec;
  data: unknown;
  invoke?: InvokeAction;
}

/**
 * Edits the bound object, or creates one, through a view action. Shown
 * disabled, with the reason, while it cannot submit (read-only source…).
 */
export function FormWidget({ widget, data, invoke }: FormWidgetProps) {
  const state = useFormWidget(widget, data, invoke);
  if (state.loadingFields) return <Skeleton active paragraph={{ rows: 3 }} />;
  if (state.fields.length === 0) return <Empty description="No field to edit." />;

  return (
    <>
      {state.blocked && <Alert type="info" showIcon title={state.blocked} />}
      <Form
        key={state.targetKey}
        form={state.form}
        layout="vertical"
        size="small"
        initialValues={state.initial}
        onFinish={state.submit}
        disabled={Boolean(state.blocked)}
      >
        {state.fields.map((field) => (
          <FormFieldControl key={field.key} field={field} disabled={Boolean(state.blocked)} />
        ))}
        <Button type="primary" htmlType="submit" loading={state.submitting}>
          {state.submitLabel}
        </Button>
      </Form>
    </>
  );
}
