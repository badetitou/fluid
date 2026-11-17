import { lazy, Suspense } from 'react';
import type { PageActionPanelProps } from '../../pageAction';

// Loaded on demand: the panel renders views (ViewRenderer) and reads the plugin
// catalog, which both import the built-in plugin list back. A static import from
// builtin.ts would read BUILTIN_PLUGINS before it is initialized.
const ChatPanel = lazy(() => import('./ChatPanel').then((m) => ({ default: m.ChatPanel })));

/** The chat panel, fetched the first time the action is opened. */
export function LazyChatPanel(props: PageActionPanelProps) {
  return (
    <Suspense fallback={null}>
      <ChatPanel {...props} />
    </Suspense>
  );
}
