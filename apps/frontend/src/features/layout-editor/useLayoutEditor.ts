import { useRef, useState } from 'react';
import type { Widget } from '@fluid/shared';
import { mergeAdditions, NO_ADDITIONS, type SpecAdditions } from '../../entities/widget-clipboard';
import { applyLayout, compact, resolveLayout } from '../../views/gridLayout';

interface Draft {
  key: string | undefined;
  widgets: Widget[];
  title: string;
  additions: SpecAdditions;
}

interface Options {
  /** Key of the view being shown; a draft never outlives a switch to another view. */
  viewKey: string | undefined;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /**
   * Persists the arranged widgets, the view's title and the queries and actions
   * pasted widgets brought; resolves true on success.
   */
  onSave: (widgets: Widget[], title: string, additions: SpecAdditions) => Promise<boolean>;
}

/**
 * Arranging a view's widgets with the mouse, like widgets on a macOS desktop.
 * Editing switches the column to full screen (undone on exit) and keeps a
 * draft of the widgets and of the view's title until it is saved or cancelled,
 * with the queries and actions pasted widgets brought from other views.
 */
export function useLayoutEditor({ viewKey, isFullscreen, onToggleFullscreen, onSave }: Options) {
  const [draft, setDraft] = useState<Draft | null>(null);
  // Whether entering layout edit switched the column to full screen.
  const enteredFullscreen = useRef(false);
  // The widget whose options are shown next to the grid.
  const [selectedId, setSelectedId] = useState<string>();
  const current = draft && draft.key === viewKey ? draft : null;
  const widgets = current?.widgets ?? null;
  const title = current?.title ?? '';
  const additions = current?.additions ?? NO_ADDITIONS;

  const start = (initial: Widget[], initialTitle: string) => {
    setDraft({ key: viewKey, widgets: initial, title: initialTitle, additions: NO_ADDITIONS });
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

  const change = (next: Widget[]) => setDraft({ key: viewKey, widgets: next, title, additions });
  const rename = (next: string) => widgets && setDraft({ key: viewKey, widgets, title: next, additions });

  /** Adds a widget below the others, with the queries and actions it brings, and selects it. */
  const add = (widget: Widget, brought: SpecAdditions = NO_ADDITIONS) => {
    if (!widgets) return;
    setDraft({ key: viewKey, widgets: [...widgets, widget], title, additions: mergeAdditions(additions, brought) });
    setSelectedId(widget.id);
  };

  /** Replaces the widget of the same id. */
  const replace = (widget: Widget) => widgets && change(widgets.map((w) => (w.id === widget.id ? widget : w)));

  /** Close the gaps between widgets. */
  const tidy = () => widgets && change(applyLayout(widgets, compact(resolveLayout(widgets))));

  const save = async () => {
    if (!widgets) return;
    if (await onSave(applyLayout(widgets, resolveLayout(widgets)), title.trim() || 'Untitled view', additions)) exit();
  };

  return {
    editing: widgets !== null,
    widgets,
    title,
    additions,
    start,
    change,
    rename,
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
