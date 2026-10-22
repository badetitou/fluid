import { Typography } from 'antd';
import type { CoreWidgetType } from '@fluid/shared';
import { useWidgetCatalog } from '../../views/plugin-api';
import { WIDGET_GROUPS, WIDGET_INFO } from '../../views/widgets/widgetInfo';
import styles from './WidgetBuilder.module.css';

const TYPES = Object.keys(WIDGET_INFO) as CoreWidgetType[];

/** Every built-in widget type of the enabled collections, by group; clicking one adds it to the view. */
export function WidgetCatalog({ onAdd }: { onAdd: (type: CoreWidgetType) => void }) {
  const { renderers } = useWidgetCatalog();
  const types = TYPES.filter((type) => renderers.has(type));
  return (
    <div className={styles.catalog}>
      <Typography.Text strong>Add a widget</Typography.Text>
      <Typography.Text type="secondary" className={styles.note}>
        Click a widget to add it below the others, or click a widget of the view to edit it.
      </Typography.Text>
      {WIDGET_GROUPS.map((group) => (
        <section key={group} aria-label={group} className={styles.group}>
          <Typography.Text type="secondary" className={styles.groupTitle}>
            {group}
          </Typography.Text>
          {types.filter((type) => WIDGET_INFO[type].group === group).map((type) => {
            const info = WIDGET_INFO[type];
            return (
              <button key={type} type="button" className={styles.entry} onClick={() => onAdd(type)}>
                <span className={styles.entryIcon}>{info.icon}</span>
                <span className={styles.entryText}>
                  <span className={styles.entryLabel}>{info.label}</span>
                  <span className={styles.entryDescription}>{info.description}</span>
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
