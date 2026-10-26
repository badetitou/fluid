import { Select } from 'antd';
import { useThemeChoice } from '../../entities/plugin';
import { ThemeSwatches } from './ThemeSwatches';
import styles from './PluginManager.module.css';

/** Picks the active theme among those of the enabled plugins. */
export function ThemeSelect({ className }: { className?: string }) {
  const { themes, active, setTheme } = useThemeChoice();
  return (
    <Select
      className={`${styles.select} ${className ?? ''}`}
      value={active.id}
      onChange={setTheme}
      aria-label="Theme"
      options={themes.map((t) => ({
        value: t.id,
        label: (
          <>
            <ThemeSwatches theme={t} />
            {t.label}
          </>
        ),
      }))}
    />
  );
}
