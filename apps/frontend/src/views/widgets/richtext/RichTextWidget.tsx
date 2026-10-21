import { Empty, Typography } from 'antd';
import type { RichTextWidget as RichTextWidgetSpec } from '@fluid/shared';
import { CodeBlock } from './CodeBlock';
import { Markdown } from './Markdown';
import { resolveFormat, textOf } from './richTextModel';
import styles from './RichText.module.css';

/** A long text property in full: rendered Markdown, highlighted code, or plain text. */
export function RichTextWidget({ widget, data }: { widget: RichTextWidgetSpec; data: unknown }) {
  const text = textOf(data, widget.field);
  if (!text) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No text" />;

  switch (resolveFormat(text, widget.format)) {
    case 'markdown':
      return <Markdown text={text} />;
    case 'code':
      return <CodeBlock code={text} language={widget.language} />;
    default:
      return <Typography.Paragraph className={styles.plain}>{text}</Typography.Paragraph>;
  }
}
