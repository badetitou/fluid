import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Button, Empty, Flex, Tooltip, theme } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { ErrorBoundary } from './ErrorBoundary';

interface MillerListLayoutProps {
  /** One node per navigation level. Each already renders its own header + body. */
  children: ReactNode;
  /** Number of consecutive columns shown at once. */
  visibleCount?: number;
  /** Optional label per column, shown as a tooltip on the pager. */
  labels?: string[];
}

/**
 * Lays out Miller navigation columns side by side, showing a sliding window of
 * `visibleCount` consecutive columns (two by default). When navigation opens a
 * new column the window follows it, so the last two levels are always on screen.
 *
 * A small pager at the bottom (in the spirit of the Pharo/GT inspector pager)
 * shows one box per column, highlights the visible ones, and lets the user jump
 * to any level. Columns outside the window stay mounted (just hidden) so their
 * local state — selected perspective, pagination — survives scrolling back.
 *
 * Each column is wrapped in an error boundary so a single failing perspective
 * cannot blank the screen.
 */
export function MillerListLayout({ children, visibleCount = 2, labels }: MillerListLayoutProps) {
  const { token } = theme.useToken();
  const columns = Children.toArray(children);
  const count = columns.length;
  const windowSize = Math.max(1, Math.min(visibleCount, count));
  const maxStart = Math.max(0, count - windowSize);

  const [start, setStart] = useState(maxStart);
  const [prevCount, setPrevCount] = useState(count);
  const [pagerHovered, setPagerHovered] = useState(false);
  // Follow navigation: when columns are added, slide to show the newest ones.
  if (count !== prevCount) {
    setPrevCount(count);
    if (count > prevCount) setStart(maxStart);
  }
  const first = Math.min(start, maxStart);
  const last = first + windowSize - 1;

  if (count === 0) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Empty description="Nothing to show" />
      </Flex>
    );
  }

  /** Slides the window the minimum amount needed to bring `index` into view. */
  const reveal = (index: number) => {
    if (index < first) setStart(index);
    else if (index > last) setStart(index - windowSize + 1);
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        background: token.colorBgLayout,
        borderRadius: token.borderRadius,
      }}
    >
      <Flex style={{ height: '100%', overflow: 'hidden' }}>
        {columns.map((column, index) => {
          const shown = index >= first && index <= last;
          return (
            <div
              key={isValidElement(column) && column.key != null ? column.key : index}
              style={{
                flex: '1 1 0',
                minWidth: 0,
                borderRight:
                  index < last ? `1px solid ${token.colorBorderSecondary}` : 'none',
                display: shown ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <ErrorBoundary>{column}</ErrorBoundary>
            </div>
          );
        })}
      </Flex>

      {count > windowSize && (
        <Flex
          align="center"
          justify="center"
          gap={2}
          onMouseEnter={() => setPagerHovered(true)}
          onMouseLeave={() => setPagerHovered(false)}
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            padding: '2px 4px',
            borderRadius: 999,
            background: token.colorBgElevated,
            boxShadow: token.boxShadowTertiary,
            opacity: pagerHovered ? 1 : 0.45,
            transition: `opacity ${token.motionDurationMid}`,
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<LeftOutlined />}
            disabled={first === 0}
            onClick={() => setStart(first - 1)}
            aria-label="Previous column"
          />
          <Flex
            gap={3}
            style={{ maxWidth: '60vw', overflowX: 'auto' }}
          >
            {columns.map((_, index) => {
              const shown = index >= first && index <= last;
              return (
                <Tooltip key={index} title={labels?.[index]} mouseEnterDelay={0.4}>
                  <button
                    type="button"
                    aria-label={labels?.[index] ?? `Column ${index + 1}`}
                    aria-current={shown}
                    onClick={() => reveal(index)}
                    style={{
                      width: 10,
                      height: 14,
                      padding: 0,
                      flexShrink: 0,
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: `1px solid ${shown ? token.colorPrimary : token.colorBorder}`,
                      background: shown ? token.colorPrimaryBg : 'transparent',
                    }}
                  />
                </Tooltip>
              );
            })}
          </Flex>
          <Button
            type="text"
            size="small"
            icon={<RightOutlined />}
            disabled={first === maxStart}
            onClick={() => setStart(first + 1)}
            aria-label="Next column"
          />
        </Flex>
      )}
    </div>
  );
}
