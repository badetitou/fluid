import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Button } from 'antd';
import { FullscreenExitOutlined } from '@ant-design/icons';
import { enterPresentation, isTopPresentation } from './presentationStack';
import styles from './PresentationFrame.module.css';

interface PresentationFrameProps {
  /** Presenting: the children fill the window, with nothing around them. */
  active: boolean;
  onExit: () => void;
  /** Class of the frame when it is not presenting. */
  className?: string;
  children: ReactNode;
}

/**
 * Wraps content that can be shown alone on a big screen. Presenting only
 * restyles the wrapper, so the children stay mounted and keep their state.
 * The browser's own full screen (F11) then removes the last of the chrome;
 * Escape, or the button that appears in the top-right corner, leaves.
 */
export function PresentationFrame({ active, onExit, className, children }: PresentationFrameProps) {
  const id = useRef(Symbol('presentation')).current;
  const exit = useRef(onExit);
  useLayoutEffect(() => {
    exit.current = onExit;
  });

  useEffect(() => {
    if (!active) return;
    const leave = enterPresentation(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopPresentation(id)) exit.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      leave();
    };
  }, [active, id]);

  return (
    <div className={active ? styles.presenting : className}>
      {children}
      {active && (
        <>
          <Button className={styles.exit} aria-label="Exit presentation" icon={<FullscreenExitOutlined />} onClick={onExit} />
          <div className={styles.hint} role="status">
            F11 for full screen · Esc to exit
          </div>
        </>
      )}
    </div>
  );
}
