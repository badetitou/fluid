import { App as AntdApp } from 'antd';
import type { ViewSpec } from '@fluid/shared';
import { pasteWidget, useWidgetClipboard, type CopiedWidget } from '../../entities/widget-clipboard';
import type { WidgetBuilderTarget } from './useWidgetBuilder';

/**
 * Copying the selected widget and pasting a copied one into the view being
 * edited, from the side panel or with ⌘C / ⌘V (Ctrl+C / Ctrl+V).
 */
export function useWidgetCopyPaste(spec: ViewSpec, target: WidgetBuilderTarget) {
  const { message } = AntdApp.useApp();
  const { selected } = target;

  const paste = (copied: CopiedWidget) => {
    const { widget, additions } = pasteWidget(copied, { widgets: target.widgets ?? [], queries: spec.queries, actions: spec.actions });
    target.add(widget, additions);
    const brought = Object.keys(additions.queries).length + Object.keys(additions.actions).length;
    message.success(brought > 0 ? 'Widget pasted, with the queries it uses' : 'Widget pasted');
  };

  const copiedMessage = () => message.success('Widget copied: paste it in any view being edited');
  const { copied, copy } = useWidgetClipboard({ selected, spec, onPaste: paste, onCopied: copiedMessage });

  return {
    /** The widget copied last, ready to paste. */
    copied,
    copy: () => {
      if (!selected) return;
      copy(selected, spec);
      copiedMessage();
    },
    paste: () => copied && paste(copied),
  };
}
