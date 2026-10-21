import styles from './FluidLogo.module.css';

/**
 * The fluid mark, flat: a small graph (a cycle of three nodes, one branch) in
 * straight edges and solid dots. Single ink (`currentColor`), sized like an icon.
 */
export function FluidLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`${styles.logo} ${className ?? ''}`}>
      <path d="M6 24L13 10M13 10L21 20M6 24L21 20M21 20L26 6.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <g fill="currentColor">
        <circle cx="6" cy="24" r="3.5" />
        <circle cx="13" cy="10" r="3.5" />
        <circle cx="21" cy="20" r="4.5" />
        <circle cx="26" cy="6.5" r="3" />
      </g>
    </svg>
  );
}
