import styles from './SourceSwitcher.module.css';

/** A source as `<name> — <url>`, the URL toned down; the URL alone when unnamed. */
export function SourceOptionLabel({ url, name }: { url: string; name?: string }) {
  return (
    <span className={styles.option} title={url}>
      {name && (
        <>
          <span className={styles.name}>{name}</span>
          <span className={styles.dash}>—</span>
        </>
      )}
      <span className={styles.url}>{url}</span>
    </span>
  );
}
