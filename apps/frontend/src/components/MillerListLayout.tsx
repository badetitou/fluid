import { Children, type ReactNode } from 'react';
import { Empty, Flex, theme } from 'antd';
import { ErrorBoundary } from './ErrorBoundary';

interface MillerListLayoutProps {
  /** One node per navigation level. Each already renders its own header + body. */
  children: ReactNode;
}

/**
 * Lays out Miller navigation columns side by side. Columns keep a comfortable
 * minimum width and the row scrolls horizontally once they no longer fit, rather
 * than shrinking every column into an unreadable sliver. Each column is wrapped
 * in an error boundary so a single failing perspective cannot blank the screen.
 */
export function MillerListLayout({ children }: MillerListLayoutProps) {
  const { token } = theme.useToken();
  const columns = Children.toArray(children);

  if (columns.length === 0) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Empty description="Nothing to show" />
      </Flex>
    );
  }

  return (
    <Flex
      style={{
        height: '100%',
        width: '100%',
        background: token.colorBgLayout,
        borderRadius: token.borderRadius,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {columns.map((column, index) => (
        <div
          key={index}
          style={{
            flex: '1 0 340px',
            minWidth: 320,
            borderRight:
              index < columns.length - 1
                ? `1px solid ${token.colorBorderSecondary}`
                : 'none',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ErrorBoundary>{column}</ErrorBoundary>
        </div>
      ))}
    </Flex>
  );
}
