import { Empty } from 'antd';
import { SavedSourceRow } from './SavedSourceRow';
import { useSourceSwitcher } from './useSourceSwitcher';
import styles from './SourceSwitcher.module.css';

/** The sources the user kept, to rename, switch to or forget. */
export function SavedSourcesList() {
  const { current, saved, switchTo, rename, forget } = useSourceSwitcher();
  if (saved.length === 0)
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sources you connect to are kept here." />;
  return (
    <div className={styles.list}>
      {saved.map((source) => (
        <SavedSourceRow
          key={source.url}
          source={source}
          current={source.url === current}
          onSwitch={() => switchTo(source.url)}
          onRename={(name) => rename(source.url, name)}
          onForget={() => forget(source.url)}
        />
      ))}
    </div>
  );
}
