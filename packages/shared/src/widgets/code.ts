import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { dataBindingSchema, widgetBase } from './common';

/** Where an annotation or a rule finding sits in the source: line/column, or character offsets. */
const codePositionFields = {
  /** Dot path of the line (1-based) an annotation starts at. */
  lineField: z.string().min(1).optional(),
  /** Dot path of the last line (inclusive) it covers. */
  endLineField: z.string().min(1).optional(),
  /** Dot path of the column (1-based) it starts at; the whole line when omitted. */
  columnField: z.string().min(1).optional(),
  /** Dot path of the column (1-based, exclusive) it ends at. */
  endColumnField: z.string().min(1).optional(),
  /** Dot path of a character offset into the source, used instead of line/column. */
  startOffsetField: z.string().min(1).optional(),
  /** Dot path of the offset the annotation ends at. */
  endOffsetField: z.string().min(1).optional(),
  /** 0: offsets from 0, end exclusive (default). 1: from 1, end inclusive (Smalltalk intervals). */
  offsetBase: z.union([z.literal(0), z.literal(1)]).optional(),
};

/**
 * Source code shown in full, with line numbers and a search box. On top of the
 * highlighted text it can:
 * - show the diff against another version (`compare`), from the same object or
 *   another query: unchanged runs are folded around the changes;
 * - mark static terms (`highlight`, e.g. halt);
 * - annotate lines and ranges with messages coming from the data
 *   (`annotations`): linter results, critiques, failing tests, coverage…
 */
export const codeAnnotationsSchema = z.object({
  /** Where the annotations come from; omit to read `field` in the bound object. */
  data: dataBindingSchema.optional(),
  /** Dot path of the annotation list in the bound object (when `data` is omitted). */
  field: z.string().min(1).optional(),
  ...codePositionFields,
  messageField: z.string().min(1),
  /** Dot path of the severity: error/warning/info, or words like high, major, hint. */
  severityField: z.string().min(1).optional(),
  /** Dot path of the rule or check name, shown next to the message. */
  ruleField: z.string().min(1).optional(),
});
export type CodeAnnotations = z.infer<typeof codeAnnotationsSchema>;

/**
 * The syntax tree of the shown source, as rows: the active graph decorators run
 * on it and their findings are shown as annotations. Position fields have the
 * same meaning as in `annotations`.
 */
export const codeRulesSchema = z
  .object({
    /** The AST rows (one per syntax node). */
    data: dataBindingSchema,
    /** Dot path of the row id (default "id"). */
    idField: z.string().min(1).optional(),
    /** Dot path of the parent's id; a parent may be an object holding the id. */
    parentField: z.string().min(1),
    /** Dot path of the node kind (default "kind"). */
    kindField: z.string().min(1).optional(),
    /** Dot path of the node name (default "name"). */
    nameField: z.string().min(1).optional(),
    ...codePositionFields,
  })
  .refine((r) => r.lineField !== undefined || r.startOffsetField !== undefined, {
    message: 'rules needs a position: set "lineField" or "startOffsetField"',
  });
export type CodeRules = z.infer<typeof codeRulesSchema>;

export const codeCompareSchema = z.object({
  /** Where the other version comes from; omit to read `field` in the bound object. */
  data: dataBindingSchema.optional(),
  /** Dot path of the other version's text. */
  field: z.string().min(1).optional(),
  /** Name of the other version (default "before"). */
  label: z.string().min(1).optional(),
});
export type CodeCompare = z.infer<typeof codeCompareSchema>;

export const codeWidgetSchema = z.object({
  type: z.literal('code'),
  ...widgetBase,
  /** Binds to the object holding the source (or to the source itself). */
  data: dataBindingSchema,
  /** Dot path of the source in the bound object; omit when the binding is the text. */
  field: z.string().min(1).optional(),
  /** Language (e.g. "tsx", "java", "python", "sql", "smalltalk"); guessed when omitted. */
  language: z.string().min(1).optional(),
  /** Older version to diff against: the widget then shows the changes. */
  compare: codeCompareSchema.optional(),
  /** Unchanged lines kept around each change of a diff (default 3; the rest folds). */
  context: z.number().int().min(0).optional(),
  /** Terms always highlighted (case-insensitive), e.g. ["halt", "flag:"]. */
  highlight: z.array(z.string().min(1)).optional(),
  annotations: codeAnnotationsSchema.optional(),
  /** Syntax tree the active graph decorators run on. */
  rules: codeRulesSchema.optional(),
  /** Show the search box (default true). */
  search: z.boolean().optional(),
  /** Wrap long lines instead of scrolling (default false). */
  wrap: z.boolean().optional(),
});
export type CodeWidget = z.infer<typeof codeWidgetSchema>;

/** How the LLM is told to use the code widget. */
export const codeWidgetDoc = `- { "id": string, "type": "code", "title"?: string, "span"?: 1..24, "height"?: number,
    "data": { "query": ..., "path"?: "<dot path to the object>" }, "field"?: "<source field>", "language"?: string,
    "compare"?: { "data"?: DataBinding, "field"?: string, "label"?: string }, "context"?: number,
    "highlight"?: [string, ...], "search"?: boolean, "wrap"?: boolean,
    "annotations"?: { "data"?: DataBinding, "field"?: string, "lineField"?: string, "endLineField"?: string,
      "columnField"?: string, "endColumnField"?: string, "startOffsetField"?: string, "endOffsetField"?: string,
      "offsetBase"?: 0|1, "messageField": string, "severityField"?: string, "ruleField"?: string },
    "rules"?: { "data": DataBinding, "parentField": string, "idField"?: string, "kindField"?: string,
      "nameField"?: string, "lineField"?: string, "endLineField"?: string, "columnField"?: string,
      "endColumnField"?: string, "startOffsetField"?: string, "endOffsetField"?: string, "offsetBase"?: 0|1 } }
    Use it for SOURCE CODE (files, methods, functions, scripts, queries): line numbers and a search box.
    - DIFF: when the API exposes another version of the same source (previous version, base of a change,
      original/refactored…), set "compare" to it; "field" is read in the bound object, or in "compare.data".
    - LINT / ANNOTATIONS: when the source has related findings (critiques, issues, warnings, diagnostics,
      failing assertions, coverage…), select them and set "annotations": "field" for a nested list, or
      "data" for another query. Map their position (line[/column], or character offsets with
      "startOffsetField"/"endOffsetField"; "offsetBase": 1 for 1-based inclusive intervals as in Pharo),
      "messageField", "severityField" (error/warning/info…) and "ruleField".
    - RULES: when the API exposes the syntax tree (AST nodes with kind, parent and position) of the source,
      set "rules" to those rows: the active graph decorators run on them and their findings are shown as annotations.
    Prefer it over "richtext" for code; keep "richtext" for Markdown.`;

/**
 * A curated view for APIs exposing a `Method` concept with its critiques and
 * previous version (code analysis, e.g. Moose or a Pharo image). No public API
 * ships one: it serves as a reference.
 */
export const methodSourceExample: ViewSpec = {
  version: 1,
  id: 'builtin:method-source',
  concept: 'Method',
  scope: 'detail',
  title: 'Method source',
  description: 'The source of a method annotated with its critiques, and its changes since the previous version.',
  queries: {
    method: {
      query: /* GraphQL */ `
        query FluidMethodSource($id: ID!) {
          method(id: $id) {
            id
            selector
            sourceCode
            critiques {
              rule
              message
              severity
              line
            }
            previousVersion {
              sourceCode
            }
            syntaxNodes {
              id
              kind
              name
              line
              parent {
                id
              }
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'source',
      type: 'code',
      title: 'Source',
      data: { query: 'method', path: 'method' },
      field: 'sourceCode',
      language: 'smalltalk',
      highlight: ['halt', 'flag:'],
      annotations: {
        field: 'critiques',
        lineField: 'line',
        messageField: 'message',
        severityField: 'severity',
        ruleField: 'rule',
      },
      // The active graph decorators run on the syntax tree of the method.
      rules: { data: { query: 'method', path: 'method.syntaxNodes' }, parentField: 'parent', lineField: 'line' },
    },
    {
      id: 'changes',
      type: 'code',
      title: 'Changes since the previous version',
      data: { query: 'method', path: 'method' },
      field: 'sourceCode',
      language: 'smalltalk',
      compare: { field: 'previousVersion.sourceCode', label: 'previous version' },
    },
  ],
};
