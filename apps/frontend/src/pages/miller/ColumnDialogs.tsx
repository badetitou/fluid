import { lazy, Suspense } from 'react';
import type { ViewSpec } from '@fluid/shared';
import type { SavedView } from '../../entities/view';
import type { AssistantTarget } from '../../features/view-assistant';
import { withScope } from '../../views/viewScope';
import type { ColumnDialogs as Dialogs } from './useColumnDialogs';

// Editors are loaded on first use: most column visits never open one.
const ViewAssistantModal = lazy(() =>
  import('../../features/view-assistant').then((m) => ({ default: m.ViewAssistantModal })),
);
const ViewEditorModal = lazy(() =>
  import('../../features/view-json-editor').then((m) => ({ default: m.ViewEditorModal })),
);
const LlmSettingsModal = lazy(() =>
  import('../../features/llm-settings').then((m) => ({ default: m.LlmSettingsModal })),
);

interface ColumnDialogsProps {
  dialogs: Dialogs;
  target: AssistantTarget;
  /** A view was created or updated from one of the editors. */
  onSaved: (view: SavedView, asDashboard?: boolean) => void;
}

/** The editors of a Miller column (assistant, JSON, LLM settings), mounted only while open. */
export function ColumnDialogs({ dialogs, target, onSaved }: ColumnDialogsProps) {
  const { dialog, settingsOpen } = dialogs.state;
  const saved = (view: SavedView) => {
    dialogs.close();
    onSaved(view, dialog?.kind === 'assistant' && dialog.seed?.asDashboard);
  };
  // "Open in JSON editor" from the assistant: continue from its spec as a new view.
  const openJson = (spec: ViewSpec) =>
    dialogs.openJson({ title: spec.title, spec: withScope(spec, spec.scope ?? target.scope ?? 'list'), isDefault: false });

  // One boundary per editor: loading the settings must not hide the open editor.
  return (
    <>
      {dialog?.kind === 'assistant' && (
        <Suspense fallback={null}>
          <ViewAssistantModal
            target={target}
            editing={dialog.editing}
            from={dialog.from}
            seed={dialog.seed}
            onClose={dialogs.close}
            onSaved={saved}
            onOpenJson={openJson}
            onOpenSettings={dialogs.openSettings}
          />
        </Suspense>
      )}
      {dialog?.kind === 'json' && (
        <Suspense fallback={null}>
          <ViewEditorModal concept={target.concept} draft={dialog.draft} onClose={dialogs.close} onSaved={saved} />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <LlmSettingsModal onClose={dialogs.closeSettings} />
        </Suspense>
      )}
    </>
  );
}
