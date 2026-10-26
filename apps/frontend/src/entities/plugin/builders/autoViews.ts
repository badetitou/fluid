import { buildDefaultView, buildDetailView, buildTreeView, withEditForm } from '../../../views/registry';
import type { Perspective, ViewBuilder, ViewBuilderContext } from '../viewBuilder';

/** The auto detail perspective of a drilled-in item, editing it where the source accepts writes. */
function detailPerspective({ concept, itemId, conceptByName, queriesByType, writable }: ViewBuilderContext): Perspective | null {
  if (!itemId) return null;
  const built = buildDetailView(concept, { conceptByName, queriesByType });
  const spec = built && writable ? withEditForm(built, concept) : built;
  return spec ? { key: spec.id, title: `${concept.name} detail`, origin: 'auto', spec, defaultFor: 'detail' } : null;
}

/** The auto overview of a list column, and a tree for concepts whose data forms a hierarchy. */
function listPerspectives({ concept, itemId, conceptByName, queriesByType }: ViewBuilderContext): Perspective[] {
  const list: Perspective[] = [];
  const overview = buildDefaultView(concept);
  if (overview) list.push({ key: overview.id, title: overview.title, origin: 'auto', spec: overview });
  const tree = itemId ? null : buildTreeView(concept, { conceptByName, queriesByType });
  if (tree) list.push({ key: tree.id, title: tree.title, origin: 'auto', spec: tree });
  return list;
}

/** Views built from the introspected schema, so every concept renders before anyone crafts a view. */
export const autoViewBuilder: ViewBuilder = {
  id: 'auto-views',
  label: 'Automatic views',
  perspectives: (context) => {
    const detail = detailPerspective(context);
    return detail ? [detail, ...listPerspectives(context)] : listPerspectives(context);
  },
};
