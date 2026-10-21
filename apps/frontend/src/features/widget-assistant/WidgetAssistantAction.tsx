import { lazy, Suspense, useState } from 'react';
import { Dropdown } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { Widget } from '@fluid/shared';
import type { SavedView } from '../../entities/view';
import type { WidgetTarget } from './useWidgetAssistant';
import styles from './WidgetEditorModal.module.css';

const WidgetEditorModal = lazy(() => import('./WidgetEditorModal').then((m) => ({ default: m.WidgetEditorModal })));

interface WidgetAssistantActionProps {
  widget: Widget;
  /** The saved view the widget belongs to. */
  view: Omit<WidgetTarget, 'widget'>;
  onSaved: (updatedView: SavedView) => void;
}

/** The "…" menu of a widget card, offering to edit the widget with the assistant. */
export function WidgetAssistantAction({ widget, view, onSaved }: WidgetAssistantActionProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Dropdown
        menu={{ items: [{ key: 'edit', label: 'Edit with AI', onClick: () => setOpen(true) }] }}
        trigger={['click']}
      >
        <MoreOutlined className={styles.trigger} aria-label="Widget actions" />
      </Dropdown>
      {open && (
        <Suspense fallback={null}>
          <WidgetEditorModal
            target={{ ...view, widget }}
            onClose={() => setOpen(false)}
            onSaved={(v) => {
              setOpen(false);
              onSaved(v);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
