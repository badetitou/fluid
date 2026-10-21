import { theme, Typography } from 'antd';
import { Highlight, Prism, themes } from 'prism-react-renderer';
import { guessLanguage, isDarkColor } from './richTextModel';
import styles from './RichText.module.css';

/** Highlighted source code, in a theme matching the app's, with a copy button. */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { token } = theme.useToken();
  const guessed = guessLanguage(code, language);
  const lang = guessed in Prism.languages ? guessed : 'plain';
  const codeTheme = isDarkColor(token.colorBgContainer) ? themes.vsDark : themes.github;

  return (
    <div className={styles.codeWrapper}>
      <Highlight theme={codeTheme} code={code.replace(/\n$/, '')} language={lang}>
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
