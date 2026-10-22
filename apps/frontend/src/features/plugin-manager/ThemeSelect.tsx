import { Select } from 'antd';
import { useThemeChoice } from '../../entities/plugin';
import type { ThemeDefinition } from '../../shared/theme';
import styles from './PluginManager.module.css';

/** A few colors of a theme, to recognise it in the list. */
function Swatches({ theme }: { theme: ThemeDefinition }) {
  const tokens = theme.light ?? theme.dark;
  const colors = tokens
    ? [tokens.surface, tokens.primary, ...(tokens.series ?? []).slice(1, 3)]
    : [];
  return (
    <span className={styles.swatches}>
      {colors.map((c, i) => (
        <span key={i} className={styles.swatch} style={{ background: c }} />
      ))}
    </span>
  );
}

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
            <Swatches theme={t} />
            {t.label}
          </>
        ),
      }))}
    />
  );
}
