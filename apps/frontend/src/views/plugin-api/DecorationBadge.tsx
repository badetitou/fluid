import { Tag, Tooltip } from 'antd';
import type { Decoration } from '@fluid/shared';
import { tagColor, worstSeverity } from './decorationModel';
import { useWidgetTheme } from './widgetTheme';
import styles from './DecorationBadge.module.css';

/** The tags of a decoration as small colored tags, plus a dot for its worst finding. Nothing when empty. */
export function DecorationBadge({ decoration, type = 'decoration' }: { decoration?: Decoration; type?: string }) {
  const theme = useWidgetTheme(type);
  if (!decoration || (decoration.tags.length === 0 && decoration.findings.length === 0)) return null;
  const severity = worstSeverity(decoration.findings);
  const messages = (
    <ul className={styles.messages}>
      {decoration.findings.map((f, i) => (
        <li key={i}>{f.message}</li>
      ))}
    </ul>
  );
  const content = (
    <span className={styles.badge}>
      {severity && <span className={styles.dot} style={{ background: theme.status[severity] }} />}
      {decoration.tags.map((tag) => (
        <Tag key={tag} className={styles.tag} color={tagColor(tag, theme.series)} bordered={false}>
          {tag}
        </Tag>
      ))}
    </span>
  );
  return decoration.findings.length > 0 ? <Tooltip title={messages}>{content}</Tooltip> : content;
}
