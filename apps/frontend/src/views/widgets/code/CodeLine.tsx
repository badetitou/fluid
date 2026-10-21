import type { ReactNode } from 'react';
import type { Token, TokenInputProps, TokenOutputProps } from 'prism-react-renderer';
import { CloseCircleFilled, InfoCircleFilled, WarningFilled } from '@ant-design/icons';
import { worstSeverity, type Annotation, type Severity } from './annotationModel';
import type { CodeRow } from './diffModel';
import { segmentLine, type Mark } from './markModel';
import styles from './Code.module.css';

interface CodeLineProps {
  row: CodeRow;
  tokens: Token[];
  marks: Mark[];
  /** Annotations starting on this line, shown under it. */
  messages: Annotation[];
  getTokenProps: (input: TokenInputProps) => TokenOutputProps;
  /** Show the old line number too (diff). */
  diff: boolean;
}

const SIGN = { same: ' ', removed: '−', added: '+' } as const;

const SEVERITY_ICON: Record<Severity, ReactNode> = {
  error: <CloseCircleFilled />,
  warning: <WarningFilled />,
  info: <InfoCircleFilled />,
};

/** One row of code: line numbers, diff sign, highlighted and marked text, then its annotation messages. */
export function CodeLine({ row, tokens, marks, messages, getTokenProps, diff }: CodeLineProps) {
  const severity = messages.length ? worstSeverity(messages.map((m) => m.severity)) : undefined;
  const hasCurrent = marks.some((m) => m.kind === 'current');
  return (
    <>
      <div className={`${styles.row} ${styles[row.kind]}`} data-severity={severity} data-current={hasCurrent || undefined}>
        {diff && <span className={styles.lineNo}>{row.oldNo ?? ''}</span>}
        <span className={styles.lineNo}>{row.newNo ?? ''}</span>
        <span className={`${styles.gutterIcon} ${severity ? styles[severity] : ''}`}>{severity && SEVERITY_ICON[severity]}</span>
        {diff && <span className={styles.sign}>{SIGN[row.kind]}</span>}
        <span className={styles.text}>
          {segmentLine(tokens, marks).map((seg, k) => {
            const props = getTokenProps({ token: { types: seg.types, content: seg.content } });
            const markClasses = seg.marks.map((m) => styles[`mark-${m.kind}`]).join(' ');
            const title = [...seg.marks].reverse().find((m) => m.title)?.title;
            return <span key={k} {...props} className={`${props.className} ${markClasses}`} title={title} />;
          })}
        </span>
      </div>
      {messages.map((m, k) => (
        <div key={k} className={`${styles.message} ${styles[`message-${m.severity}`]}`}>
          {SEVERITY_ICON[m.severity]}
          {m.rule && <span className={styles.rule}>{m.rule}</span>}
          <span>{m.message}</span>
        </div>
      ))}
    </>
  );
}
