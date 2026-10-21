import { Typography } from 'antd';
import { Highlight, Prism, themes } from 'prism-react-renderer';
import { guessLanguage } from './richTextModel';
import styles from './RichText.module.css';

/** Highlighted source code, in the design system's duotone dark theme, with a copy button. */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const guessed = guessLanguage(code, language);
  const lang = guessed in Prism.languages ? guessed : 'plain';

  return (
    <div className={styles.codeWrapper}>
      <Highlight theme={themes.duotoneDark} code={code.replace(/\n$/, '')} language={lang}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`${className} ${styles.code}`} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((t, k) => (
                  <span key={k} {...getTokenProps({ token: t })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
      <Typography.Text className={styles.copy} copyable={{ text: code }} />
    </div>
  );
}
