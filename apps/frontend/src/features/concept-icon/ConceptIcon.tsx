import { PushpinOutlined, TableOutlined } from '@ant-design/icons';
import { CONCEPT_ICONS } from './icons';
import { useConceptIcon } from './useConceptIcon';

/** A concept's icon: the user's choice, else table for root concepts and pushpin for pinned ones. */
export function ConceptIcon({ name, isRoot }: { name: string; isRoot: boolean }) {
  const { icon } = useConceptIcon(name);
  const Icon = (icon && CONCEPT_ICONS[icon]) || (isRoot ? TableOutlined : PushpinOutlined);
  return <Icon />;
}
