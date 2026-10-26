import type { ThemeDefinition } from '../../shared/theme';
import styles from './PluginManager.module.css';

/** A few colors of a theme, to recognise it. */
export function ThemeSwatches({ theme }: { theme: ThemeDefinition }) {
  const tokens = theme.light ?? theme.dark;
  const colors = tokens ? [tokens.surface, tokens.primary, ...(tokens.series ?? []).slice(1, 3)] : [];
  return (
    <span className={styles.swatches}>
      {colors.map((c, i) => (
        <span key={i} className={styles.swatch} style={{ background: c }} />
      ))}
    </span>
  );
}
