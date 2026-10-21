import type { CodeWidget, DataBinding } from '@fluid/shared';
import { getPath } from '../../data';
import { textOf } from '../richtext/richTextModel';

// Pure logic of the code widget: where its texts and annotation rows come from.

export interface CodeSources {
  /** The shown version. */
  source: string;
  /** The older version, when the widget compares. */
  before?: string;
  /** The rows annotations are read from. */
  annotationRows: unknown[];
}

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

function annotationRowsOf(widget: CodeWidget, data: unknown, resolve: (b: DataBinding) => unknown): unknown[] {
  const spec = widget.annotations;
  if (!spec || (!spec.data && !spec.field)) return [];
  const holder = spec.data ? resolve(spec.data) : data;
  const value = spec.field ? getPath(first(holder), spec.field) : holder;
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

/** The texts and annotation rows of a code widget, from its bindings. */
export function readCodeSources(widget: CodeWidget, data: unknown, resolve: (b: DataBinding) => unknown): CodeSources {
  const { compare } = widget;
  return {
    source: textOf(data, widget.field),
    before: compare ? textOf(compare.data ? resolve(compare.data) : data, compare.field) : undefined,
    annotationRows: annotationRowsOf(widget, data, resolve),
  };
}
