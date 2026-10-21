import { initials } from './historyModel';
import styles from './History.module.css';

interface HistoryAvatarProps {
  name?: string;
  /** Picture URL, only when its host was allowed (see useAvatarConsent). */
  src?: string;
}

/**
 * The author's picture, or their initials until pictures are allowed. Plain
 * markup rather than antd's Avatar, which watches the screen size on every line.
 */
export function HistoryAvatar({ name, src }: HistoryAvatarProps) {
  if (src) return <img className={styles.avatar} src={src} alt="" referrerPolicy="no-referrer" />;
  return (
    <span className={styles.avatar} aria-hidden>
      {initials(name)}
    </span>
  );
}
