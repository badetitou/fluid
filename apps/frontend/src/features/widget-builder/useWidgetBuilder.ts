import { useMemo } from 'react';
import type { ViewSpec, Widget, WidgetType } from '@fluid/shared';
import { resolveBinding } from '../../views/data';
import { useViewData } from '../../views/useViewData';
import { WIDGET_INFO } from '../../views/widgets/widgetInfo';
import { arrayPaths, newWidget, sampleFields } from './model';

/** What the builder edits: the draft of the layout editor. */
export interface WidgetBuilderTarget {
  widgets: Widget[] | null;
  selected: Widget | undefined;
  select: (id: string | undefined) => void;
  add: (widget: Widget) => void;
  replace: (widget: Widget) => void;
  change: (widgets: Widget[]) => void;
}

/** Values offered while typing an option: the view's queries, the lists in them, the fields of the bound rows. */
export interface OptionSuggestions {
  queries: string[];
  paths: string[];
  fields: string[];
  /** Path of the rows the selected widget is bound to: where its fields are picked from. */
  rowsPath?: string;
}

/**
 * Adding widgets from the catalog and editing the selected one's options. It
 * peeks at the view's data (from the GraphQL cache) to bind new widgets and to
 * suggest fields.
 */
export function useWidgetBuilder(spec: ViewSpec, target: WidgetBuilderTarget) {
  const { results } = useViewData(spec);
  const { selected } = target;
  const widgets = target.widgets ?? [];

  const add = (type: WidgetType) =>
    target.add(newWidget(type, { widgets, queries: spec.queries, results, title: WIDGET_INFO[type].label }));

  const suggestions = useMemo(
    (): OptionSuggestions => ({
      queries: Object.keys(spec.queries),
      paths: selected ? arrayPaths(results[selected.data.query]) : [],
      fields: selected ? sampleFields(resolveBinding(selected.data, results)).all : [],
      rowsPath: selected?.data.path,
    }),
    [spec.queries, results, selected],
  );

  const remove = () => selected && target.change(widgets.filter((w) => w.id !== selected.id));

  return { selected, suggestions, add, update: target.replace, remove, close: () => target.select(undefined) };
}
