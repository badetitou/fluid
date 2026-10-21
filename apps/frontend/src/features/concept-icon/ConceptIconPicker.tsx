import type { ReactNode } from 'react';
import { IconPicker } from './IconPicker';
import { useConceptIcon } from './useConceptIcon';

/** Wraps a trigger (usually a ConceptIcon) with a popover to pick the concept's icon. */
export function ConceptIconPicker({ name, children }: { name: string; children: ReactNode }) {
  const { icon, setIcon } = useConceptIcon(name);
  return (
    <IconPicker name={name} icon={icon} onChange={setIcon}>
      {children}
    </IconPicker>
  );
}
