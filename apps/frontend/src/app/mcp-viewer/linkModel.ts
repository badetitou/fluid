import { parseColumnSegment, rootPath, type ColumnRef } from '../../navigation/millerPath';

// Links between entities in the viewer: widgets navigate the viewer's memory router to `/<Concept>@<id>`.

export interface ViewRowInfo {
  id: string;
  title: string;
  concept: string;
  scope?: string;
}

/** The item a widget link opened, from the memory router's path; null at the start page. */
export function linkedItem(pathname: string): ColumnRef | null {
  const last = pathname.split('/').filter(Boolean).pop();
  return last ? parseColumnSegment(last) : null;
}

/** The saved view to show the item in: a detail view for one item, a list view for a concept. */
export function pickView(rows: ViewRowInfo[], ref: ColumnRef): ViewRowInfo | undefined {
  const ofConcept = rows.filter((r) => r.concept === ref.concept);
  return ref.itemId === undefined ? ofConcept.find((r) => r.scope !== 'detail') : ofConcept.find((r) => r.scope === 'detail');
}

/** Where fluid opens the item, for `ui/open-link`. */
export function fluidLink(fluidUrl: string, ref: ColumnRef): string {
  return `${fluidUrl.replace(/\/+$/, '')}${rootPath({ kind: 'column', ...ref })}`;
}
