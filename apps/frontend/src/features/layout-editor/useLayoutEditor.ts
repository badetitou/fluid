import { useRef, useState } from 'react';
import type { Widget } from '@fluid/shared';
import { applyLayout, compact, resolveLayout } from '../../views/gridLayout';

interface Options {
  /** Key of the view being shown; a draft never outlives a switch to another view. */
  viewKey: string | undefined;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Persists the arranged widgets; resolves true on success. */
  onSave: (widgets: Widget[]) => Promise<boolean>;
}

/**
 * Arranging a view's widgets with the mouse, like widgets on a macOS desktop.
 * Editing switches the column to full screen (undone on exit) and keeps a
 * draft of the widgets until it is saved or cancelled.
 */
export function useLayoutEditor({ viewKey, isFullscreen, onToggleFullscreen, onSave }: Options) {
  const [draft, setDraft] = useState<{ key: string | undefined; widgets: Widget[] } | null>(null);
  // Whether entering layout edit switched the column to full screen.
  const enteredFullscreen = useRef(false);
  // The widget whose options are shown next to the grid.
  const [selectedId, setSelectedId] = useState<string>();
  const widgets = draft && draft.key === viewKey ? draft.widgets : null;

  const start = (current: Widget[]) => {
    setDraft({ key: viewKey, widgets: current });
    if (onToggleFullscreen && !isFullscreen) {
      enteredFullscreen.current = true;
      onToggleFullscreen();
    }
  };

  const exit = () => {
    setDraft(null);
    setSelectedId(undefined);
    if (enteredFullscreen.current) {
      enteredFullscreen.current = false;
      onToggleFullscreen?.();
    }
  };

  const change = (next: Widget[]) => setDraft({ key: viewKey, widgets: next });

  /** Adds a widget below the others and selects it. */
  const add = (widget: Widget) => {
    if (!widgets) return;
    change([...widgets, widget]);
    setSelectedId(widget.id);
  };

  /** Replaces the widget of the same id. */
  const replace = (widget: Widget) => widgets && change(widgets.map((w) => (w.id === widget.id ? widget : w)));

  /** Close the gaps between widgets. */
  const tidy = () => widgets && change(applyLayout(widgets, compact(resolveLayout(widgets))));

  const save = async () => {
    if (!widgets) return;
    if (await onSave(applyLayout(widgets, resolveLayout(widgets)))) exit();
  };

  return {
    editing: widgets !== null,
    widgets,
    start,
    change,
    tidy,
    save,
    exit,
    selected: widgets?.find((w) => w.id === selectedId),
    select: setSelectedId,
    add,
    replace,
  };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
