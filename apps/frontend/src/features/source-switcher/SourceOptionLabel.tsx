import styles from './SourceSwitcher.module.css';

/** A source as `<name> — <url>`, the URL toned down; the URL alone when unnamed; marked when not ready yet. */
export function SourceOptionLabel({ url, name, pending }: { url: string; name?: string; pending?: boolean }) {
  return (
    <span className={styles.option} title={url}>
      {name && (
        <>
          <span className={styles.name}>{name}</span>
          <span className={styles.dash}>—</span>
        </>
      )}
      <span className={styles.url}>{url}</span>
      {pending && <span className={styles.pending}>pending…</span>}
    </span>
  );
}
