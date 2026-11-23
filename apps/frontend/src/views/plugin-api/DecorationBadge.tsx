import { Tag, Tooltip } from 'antd';
import type { Decoration } from '@fluid/shared';
import { severityCounts, tagColor, worstSeverity, type Severity } from './decorationModel';
import { useWidgetTheme } from './widgetTheme';
import styles from './DecorationBadge.module.css';

const MAX_LISTED = 10;
const ORDER: Severity[] = ['error', 'warning', 'info'];

/** '2 errors, 1 warning', for the dot's accessible name. */
export function severityLabel(counts: Record<Severity, number>): string {
  return ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}${counts[s] > 1 ? 's' : ''}`)
    .join(', ');
}

/** The tags of a decoration as small colored tags, plus a dot for its worst finding. Nothing when empty. */
export function DecorationBadge({ decoration, type = 'decoration' }: { decoration?: Decoration; type?: string }) {
  const theme = useWidgetTheme(type);
  if (!decoration || (decoration.tags.length === 0 && decoration.findings.length === 0)) return null;
  const { findings } = decoration;
  const severity = worstSeverity(findings);
  const messages = (
    <ul className={styles.messages}>
      {findings.slice(0, MAX_LISTED).map((f, i) => (
        <li key={i}>{f.message}</li>
      ))}
      {findings.length > MAX_LISTED && <li>+{findings.length - MAX_LISTED} more</li>}
    </ul>
  );
  const content = (
    <span className={styles.badge}>
      {severity && (
        <span
          className={styles.dot}
          role="img"
          aria-label={severityLabel(severityCounts(findings))}
          style={{ background: theme.status[severity] }}
        />
      )}
      {decoration.tags.map((tag) => (
        <Tag key={tag} className={styles.tag} color={tagColor(tag, theme.series)} bordered={false}>
          {tag}
        </Tag>
      ))}
    </span>
  );
  return findings.length > 0 ? <Tooltip title={messages}>{content}</Tooltip> : content;
}
