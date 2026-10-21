import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SafeImage } from '../SafeImage';
import { CodeBlock } from './CodeBlock';
import styles from './RichText.module.css';

// Markdown comes from data: raw HTML is not rendered (react-markdown's default),
// images go through the same click-to-load check as image cells, and links open
// in a new tab without access to this window.
const components: Components = {
  img: ({ src }) => <SafeImage value={src} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
    const text = String(children);
    if (!language && !text.includes('\n')) return <code>{children}</code>;
    return <CodeBlock code={text} language={language} />;
  },
  pre: ({ children }) => <>{children}</>,
};

/** Markdown (GitHub flavour: tables, task lists, strikethrough). `inline` drops paragraph margins for cells. */
export function Markdown({ text, inline }: { text: string; inline?: boolean }) {
  return (
    <div className={inline ? `${styles.markdown} ${styles.inline}` : styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
