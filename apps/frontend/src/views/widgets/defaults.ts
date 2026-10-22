import type { DataBinding, Widget, WidgetType } from '@fluid/shared';
import { humanize } from '../fieldHeuristics';

/** Fields seen in a sample of the rows a new widget will be bound to. */
export interface SampleFields {
  /** Every scalar field, as dot paths. */
  all: string[];
  /** Fields holding text (categories, labels). */
  text: string[];
  /** Fields holding numbers. */
  numeric: string[];
}

/** What a new widget is created from: its id, title, binding and a peek at its data. */
export interface WidgetSeed {
  id: string;
  title: string;
  data: DataBinding;
  fields: SampleFields;
}

type Factory<T extends WidgetType> = (seed: WidgetSeed) => Extract<Widget, { type: T }>;

const base = ({ id, title, data }: WidgetSeed) => ({ id, title, data });

// Charts need their axes set to render: take the fields that look the part.
const isId = (path: string) => /(^|\.)id$/i.test(path);
const category = (f: SampleFields) => f.text.find((p) => !isId(p)) ?? f.all[0] ?? 'name';

/** Category and measure of a chart; without numbers to plot, it counts the rows of each category. */
function axes(s: WidgetSeed) {
  const x = category(s.fields);
  const y = s.fields.numeric[0];
  return y ? { data: s.data, x, y } : { data: { ...s.data, transform: { groupBy: x } }, x, y: 'count' };
}

function cartesian<T extends 'line' | 'bar' | 'area'>(type: T, s: WidgetSeed) {
  const { data, x, y } = axes(s);
  return { type, ...base(s), data, xField: x, yField: y };
}

/**
 * A ready-to-render widget of each type, added from the layout editor's catalog.
 * Typed exhaustively: a new widget type does not compile until it has defaults.
 */
export const WIDGET_DEFAULTS: { [T in WidgetType]: Factory<T> } = {
  table: (s) => ({ type: 'table', ...base(s) }),
  statistic: (s) => ({ type: 'statistic', ...base(s), value: { op: 'count' } }),
  descriptions: (s) => ({
    type: 'descriptions',
    ...base(s),
    items: s.fields.all.slice(0, 6).map((key) => ({ key, label: humanize(key.split('.').pop()!) })),
  }),
  tree: (s) => ({ type: 'tree', ...base(s) }),
  line: (s) => cartesian('line', s),
  bar: (s) => cartesian('bar', s),
  area: (s) => cartesian('area', s),
  pie: (s) => {
    const { data, x, y } = axes(s);
    return { type: 'pie', ...base(s), data, colorField: x, angleField: y };
  },
  scatter: (s) => ({
    type: 'scatter',
    ...base(s),
    xField: s.fields.numeric[0] ?? category(s.fields),
    yField: s.fields.numeric[1] ?? s.fields.numeric[0] ?? category(s.fields),
  }),
  richtext: (s) => ({ type: 'richtext', ...base(s), field: s.fields.text[0] }),
  code: (s) => ({ type: 'code', ...base(s), field: s.fields.text[0] }),
  // A history needs links between versions: guess the git-like field, a sample field when there is one.
  history: (s) => ({
    type: 'history',
    ...base(s),
    parentsField: s.fields.all.find((p) => /(^|\.)parents?(\.|$)/i.test(p)) ?? 'parents',
  }),
  // Folded panels titled by a text field; what each panel shows is added afterwards.
  accordion: (s) => ({ type: 'accordion', ...base(s), labelField: category(s.fields), widgets: [] }),
};

/** A new widget of `type`, with its type's defaults. */
export function defaultWidget(type: WidgetType, seed: WidgetSeed): Widget {
  return (WIDGET_DEFAULTS[type] as (seed: WidgetSeed) => Widget)(seed);
}
