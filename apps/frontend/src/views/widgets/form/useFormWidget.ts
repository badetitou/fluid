import { useMemo, useState } from 'react';
import { Form, type FormInstance } from 'antd';
import type { FormField, FormWidget } from '@fluid/shared';
import { useInputType } from '../../actions/useInputType';
import { asObject } from '../../data';
import { useViewAction, type InvokeAction } from '../../plugin-api';
import { formInputType, initialValues, resolveFormFields, toFormValue } from './formModel';

export interface FormWidgetState {
  form: FormInstance;
  fields: FormField[];
  /** Still introspecting the input type the fields are inferred from. */
  loadingFields: boolean;
  initial: Record<string, unknown>;
  /** Identifies the edited object, so the form starts over when another one is bound. */
  targetKey: string;
  /** Why the form cannot submit; undefined when it can. */
  blocked?: string;
  submitLabel: string;
  submitting: boolean;
  submit: (values: Record<string, unknown>) => Promise<void>;
}

/** The state of a form widget: its fields, its starting values, and its submission through `invoke`. */
export function useFormWidget(widget: FormWidget, data: unknown, invoke: InvokeAction | undefined): FormWidgetState {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const action = useViewAction(widget.action);
  const inputType = formInputType(action);
  const input = useInputType(inputType);
  const fields = useMemo(() => resolveFormFields(widget.fields, input), [widget.fields, input]);
  const target = widget.data ? asObject(data) : null;
  const initial = useMemo(() => initialValues(fields, target), [fields, target]);

  const blocked = !action
    ? `The view has no action “${widget.action}”.`
    : !invoke
      ? 'Read-only: allow changes to this source in Settings to edit.'
      : widget.data && !target
        ? 'Nothing to edit yet.'
        : undefined;

  const submit = async (values: Record<string, unknown>) => {
    if (!invoke) return;
    setSubmitting(true);
    const result = await invoke(widget.action, { target, form: toFormValue(values) });
    setSubmitting(false);
    if (result.ok && (widget.reset ?? !widget.data)) form.resetFields();
  };

  return {
    form,
    fields,
    loadingFields: !widget.fields?.length && Boolean(inputType) && input === undefined,
    initial,
    targetKey: String(target?.id ?? 'new'),
    blocked,
    submitLabel: widget.submitLabel ?? action?.label ?? 'Save',
    submitting,
    submit,
  };
}
