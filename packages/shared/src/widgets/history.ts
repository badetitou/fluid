import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { columnSchema, dataBindingSchema, linkToSchema, widgetBase } from './common';

/**
 * A version history drawn as a graph, like `git log --graph`: one line per
 * version (commit, document revision, edit…), with colored lanes showing where
 * the history branches and merges.
 *
 * The only required structure is the link from each version to its parent(s):
 * a list of ids, or of objects holding the id. Branches and merges are deduced
 * from it. Children are always drawn above their parents (newest first).
 */
export const historyWidgetSchema = z.object({
  type: z.literal('history'),
  ...widgetBase,
  data: dataBindingSchema,
  /** Dot path to a version's id (default: id, oid, sha or hash, whichever the row has). */
  idField: z.string().min(1).optional(),
  /** Dot path to the list of parents: ids, or objects holding the id (`parentIdField`). */
  parentsField: z.string().min(1),
  /** Dot path to the id inside a parent object (default: same lookup as `idField`). */
  parentIdField: z.string().min(1).optional(),
  /** Dot path to the text of a version (default: message, title, name… whichever the row has). */
  labelField: z.string().min(1).optional(),
  /** Dot path to the author's name. */
  authorField: z.string().min(1).optional(),
  /** Dot path to the author's picture URL (loaded only once the user allows its host). */
  avatarField: z.string().min(1).optional(),
  /** Dot path to the version's date; also orders versions that are not related. */
  dateField: z.string().min(1).optional(),
  /** Dot path to the labels pointing at a version (branches, tags…): strings or objects with a name. */
  refsField: z.string().min(1).optional(),
  /** Extra values shown at the end of each line. */
  columns: z.array(columnSchema).optional(),
  /** Opens the clicked version in a new column. */
  linkTo: linkToSchema.optional(),
});
export type HistoryWidget = z.infer<typeof historyWidgetSchema>;

/** How the LLM is told to use the history widget. */
export const historyWidgetDoc = `- { "id": string, "type": "history", "title"?: string, "span"?: 1..24, "height"?: number,
    "data": { "query": ..., "path"?: ... },
    "parentsField": string, "parentIdField"?: string, "idField"?: string, "labelField"?: string,
    "authorField"?: string, "avatarField"?: string, "dateField"?: string, "refsField"?: string,
    "columns"?: [ Column, ... ], "linkTo"?: LinkConfig }
    Use it for VERSION HISTORIES where each item points to its parent version(s): commits of a repository
    (mining software repositories), revisions or edits of a document, snapshots… It draws a git-like graph
    with branches and merges. ALWAYS select the parents (e.g. \`parents { oid }\` → "parentsField": "parents",
    "parentIdField": "oid"; or a list of ids \`parentIds\` → "parentsField": "parentIds"). Map the message
    to "labelField", the author's name/picture to "authorField"/"avatarField", the date to "dateField",
    branch or tag names to "refsField". Select the newest versions first when the API allows it.`;

/**
 * A curated view for APIs exposing a `Commit` concept (mining software
 * repositories). No public API ships one: it serves as a reference.
 */
export const commitHistoryExample: ViewSpec = {
  version: 1,
  id: 'builtin:commit-history',
  concept: 'Commit',
  scope: 'list',
  title: 'Commit graph',
  description: 'Commits with their branches and merges, authors and dates.',
  queries: {
    commits: {
      query: /* GraphQL */ `
        query FluidCommitHistory {
          commits {
            id
            message
            date
            author {
              name
              avatarUrl
            }
            parents {
              id
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'history',
      type: 'history',
      title: 'History',
      height: 480,
      data: { query: 'commits', path: 'commits' },
      parentsField: 'parents',
      parentIdField: 'id',
      labelField: 'message',
      authorField: 'author.name',
      avatarField: 'author.avatarUrl',
      dateField: 'date',
      linkTo: { concept: 'Commit', idField: 'id' },
    },
  ],
};
