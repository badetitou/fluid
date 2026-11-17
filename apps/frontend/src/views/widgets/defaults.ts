import type { CoreWidget, CoreWidgetType, DataBinding } from '@fluid/shared';
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

type Factory<T extends CoreWidgetType> = (seed: WidgetSeed) => Extract<CoreWidget, { type: T }>;

const base = ({ id, title, data }: WidgetSeed) => ({ id, title, data });

// Charts need their axes set to render: take the fields that look the part.
const isId = (path: string) => /(^|\.)id$/i.test(path);
const category = (f: SampleFields) => f.text.find((p) => !isId(p)) ?? f.all[0] ?? 'name';

/** Category and measure of a chart; without numbers to plot, it counts the rows of each category. */
function axes(s: WidgetSeed) {
  const x = category(s.fields);
  const y = s.fields.numeric[0];
  return y
    ? { data: s.data, x, y }
    : { data: { ...s.data, transform: { groupBy: x } }, x, y: 'count' };
}

function cartesian<T extends 'line' | 'bar' | 'area'>(type: T, s: WidgetSeed) {
  const { data, x, y } = axes(s);
  return { type, ...base(s), data, xField: x, yField: y };
}

/**
 * A ready-to-render widget of each type, added from the layout editor's catalog.
 * Typed exhaustively: a new widget type does not compile until it has defaults.
 */
export const WIDGET_DEFAULTS: { [T in CoreWidgetType]: Factory<T> } = {
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
  // A sankey needs a source and a target: the first two categories, each row counting one flow.
  sankey: (s) => {
    const [source = 'source', target = 'target'] = s.fields.text.filter((p) => !isId(p));
    return { type: 'sankey', ...base(s), sourceField: source, targetField: target };
  },
  richtext: (s) => ({ type: 'richtext', ...base(s), field: s.fields.text[0] }),
  code: (s) => ({ type: 'code', ...base(s), field: s.fields.text[0] }),
  // A history needs links between versions: guess the git-like field, a sample field when there is one.
  history: (s) => ({
    type: 'history',
    ...base(s),
    parentsField: s.fields.all.find((p) => /(^|\.)parents?(\.|$)/i.test(p)) ?? 'parents',
  }),
  // Runs a view action named "save": declare it in the view's actions (JSON editor or assistant).
  form: (s) => ({
    type: 'form',
    ...base(s),
    action: 'save',
    fields: s.fields.all
      .filter((p) => !isId(p))
      .slice(0, 4)
      .map((key) => ({ key })),
  }),
  // Folded panels titled by a text field; what each panel shows is added afterwards.
  accordion: (s) => ({
    type: 'accordion',
    ...base(s),
    labelField: category(s.fields),
    widgets: [],
  }),
  // A network needs its links: guess a list of linked items, a sample field when there is one.
  network: (s) => ({
    type: 'network',
    ...base(s),
    linksField: s.fields.all.find((p) => /(^|\.)(links|edges|dependencies|calls|callees|references|neighbou?rs)(\.|$)/i.test(p)) ?? 'links',
  }),
  // A class diagram needs the superclasses: the shortest path through a superclass-ish field, without its id.
  classDiagram: (s) => {
    const path = s.fields.all
      .filter((p) => /(^|\.)(super\w*|extends|parentClass|baseClass)(\.|$)/i.test(p))
      .sort((a, b) => a.length - b.length)[0];
    return { type: 'classDiagram', ...base(s), superField: path?.includes('.') ? path.replace(/\.[^.]+$/, '') : (path ?? 'superclass') };
  },
  // Boxes: size from the first numbers, color from the second, name from the usual label fields.
  boxes: (s) => ({
    type: 'boxes',
    ...base(s),
    ...(s.fields.numeric[0] ? { widthField: s.fields.numeric[0] } : {}),
    ...(s.fields.numeric[1] ? { heightField: s.fields.numeric[1] } : {}),
    ...(s.fields.numeric[2] ? { colorField: s.fields.numeric[2] } : {}),
  }),
  // A blueprint reads the class's methods and attributes: the sampled lists of those names (else the usual ones).
  blueprint: (s) => {
    const list = (name: RegExp) => s.fields.all.map((p) => p.match(name)?.[1]).find((p) => p !== undefined);
    const attributesField = list(/^(.*?\b(?:attributes|fields))\./i);
    return { type: 'blueprint', ...base(s), methodsField: list(/^(.*?\bmethods)\./i) ?? 'methods', attributesField };
  },
  // A butterfly needs the element's dependents or dependencies: the shortest such path, without its scalar.
  butterfly: (s) => {
    const side = (pattern: RegExp) => {
      const path = s.fields.all.filter((p) => pattern.test(p)).sort((a, b) => a.length - b.length)[0];
      return path?.includes('.') ? path.replace(/\.[^.]+$/, '') : undefined;
    };
    const incomingField = side(/(^|\.)(incoming\w*|callers|dependents|usedBy|clients)(\.|$)/i);
    const outgoingField = side(/(^|\.)(outgoing\w*|callees|calls|dependencies|imports)(\.|$)/i);
    return { type: 'butterfly', ...base(s), incomingField, outgoingField: outgoingField ?? (incomingField ? undefined : 'dependencies') };
  },
  // A matrix needs the targets of each element: guess a list of linked items among the sample fields.
  matrix: (s) => ({
    type: 'matrix',
    ...base(s),
    targetsField: s.fields.all.find((p) => /(^|\.)(dependencies|calls|callees|references|imports|uses|links|invocations)(\.|$)/i.test(p))?.replace(/\.[^.]+$/, '') ?? 'dependencies',
  }),
  // The geometry comes from the query (IfcGeometry fragment): nothing to pick among the fields.
  model3d: (s) => ({ type: 'model3d', ...base(s) }),
  scene3d: (s) => ({ type: 'scene3d', ...base(s) }),
  // A Spec-Fluid tab draws the node Pharo sent: nothing to pick among the fields.
  specPresenter: (s) => ({ type: 'specPresenter', ...base(s) }),
  // The analyst reads the other widgets of the view: no binding of its own.
  insight: ({ id, title }) => ({ type: 'insight', id, title }),
  // An overview pyramid needs one metric at least: a class count field, or the bound rows counted as classes.
  pyramid: (s) => ({ type: 'pyramid', ...base(s), noc: s.fields.numeric.find((p) => /classes/i.test(p)) ?? { op: 'count' } }),
};

/** A new widget of `type`, with its type's defaults. */
export function defaultWidget(type: CoreWidgetType, seed: WidgetSeed): CoreWidget {
  return (WIDGET_DEFAULTS[type] as (seed: WidgetSeed) => CoreWidget)(seed);
}
