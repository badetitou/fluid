import { useEffect } from 'react';
import type { ViewSpec, Widget } from '@fluid/shared';
import { copyWidget, parseCopiedWidget, serializeCopiedWidget, type CopiedWidget } from './model';
import { useClipboardStore } from './store';

interface Shortcuts {
  /** The widget ⌘C / Ctrl+C copies; none leaves the key to the page. */
  selected: Widget | undefined;
  spec: ViewSpec;
  onPaste: (copied: CopiedWidget) => void;
  /** Told when ⌘C / Ctrl+C copied the selected widget. */
  onCopied?: () => void;
}

// Keys typed in a field copy and paste text, not widgets.
const inField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The widget clipboard: the widget copied last in this tab, also written to
 * the system clipboard so it can be pasted in another tab. While `shortcuts`
 * are given, ⌘C / Ctrl+C copies the selected widget and ⌘V / Ctrl+V pastes one.
 */
export function useWidgetClipboard(shortcuts?: Shortcuts) {
  const copied = useClipboardStore((s) => s.copied);
  const set = useClipboardStore((s) => s.set);

  const copy = (widget: Widget, spec: ViewSpec) => {
    const next = copyWidget(widget, spec);
    set(next);
    navigator.clipboard?.writeText(serializeCopiedWidget(next)).catch(() => undefined);
    return next;
  };

  const selected = shortcuts?.selected;
  const spec = shortcuts?.spec;
  const onPaste = shortcuts?.onPaste;
  const onCopied = shortcuts?.onCopied;
  useEffect(() => {
    if (!onPaste || !spec) return;
    const onCopyKey = (e: ClipboardEvent) => {
      if (!selected || inField(e.target) || !window.getSelection()?.isCollapsed) return;
      const next = copyWidget(selected, spec);
      set(next);
      e.clipboardData?.setData('text/plain', serializeCopiedWidget(next));
      e.preventDefault();
      onCopied?.();
    };
    const onPasteKey = (e: ClipboardEvent) => {
      if (inField(e.target)) return;
      const pasted = parseCopiedWidget(e.clipboardData?.getData('text/plain') ?? '');
      if (!pasted) return;
      e.preventDefault();
      set(pasted);
      onPaste(pasted);
    };
    document.addEventListener('copy', onCopyKey);
    document.addEventListener('paste', onPasteKey);
    return () => {
      document.removeEventListener('copy', onCopyKey);
      document.removeEventListener('paste', onPasteKey);
    };
  }, [selected, spec, onPaste, onCopied, set]);

  return { copied, copy };
}
