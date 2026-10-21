import { z } from 'zod';
import type { ViewSpec } from '../view-spec';
import { dataBindingSchema, widgetBase } from './common';

/**
 * A long text property shown in full: Markdown (rendered without raw HTML,
 * images behind the same click-to-load check as image cells) or source code
 * (highlighted). `auto` picks one from the text itself.
 */
export const richTextFormatSchema = z.enum(['auto', 'markdown', 'code', 'plain']);
export type RichTextFormat = z.infer<typeof richTextFormatSchema>;

export const richTextWidgetSchema = z.object({
  type: z.literal('richtext'),
  ...widgetBase,
  /** Binds to the object holding the text (or to the text itself). */
  data: dataBindingSchema,
  /** Dot path of the text in the bound object; omit when the binding is the text. */
  field: z.string().min(1).optional(),
  format: richTextFormatSchema.optional(),
  /** Language of `code` (e.g. "json", "python", "sql"); guessed when omitted. */
  language: z.string().min(1).optional(),
});
export type RichTextWidget = z.infer<typeof richTextWidgetSchema>;

/** How the LLM is told to use the richtext widget. */
export const richTextWidgetDoc = `- { "id": string, "type": "richtext", "title"?: string, "span"?: 1..24,
    "data": { "query": ..., "path"?: "<dot path to the object>" }, "field"?: "<text field>",
    "format"?: "auto"|"markdown"|"code"|"plain", "language"?: string }
    Use it for LONG TEXT properties: Markdown bodies/descriptions/READMEs ("markdown") and source code,
    scripts, queries or JSON documents ("code", with "language" e.g. "json", "sql", "python").
    For short values inside a table or descriptions, use the Format "markdown" or "code" instead.`;

/** A curated detail view showing the widget on the public GraphQLZero API. */
export const postBodyExample: ViewSpec = {
  version: 1,
  id: 'builtin:post-body',
  concept: 'Post',
  scope: 'detail',
  title: 'Post',
  description: 'The post with its body rendered as Markdown.',
  queries: {
    post: {
      query: /* GraphQL */ `
        query FluidPostBody($id: ID!) {
          post(id: $id) {
            id
            title
            body
            user {
              id
              name
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      id: 'about',
      type: 'descriptions',
      title: 'Post',
      data: { query: 'post', path: 'post' },
      items: [
        { label: 'Title', key: 'title' },
        { label: 'Author', key: 'user.name', linkTo: { concept: 'User', idField: 'user.id' } },
      ],
    },
    {
      id: 'body',
      type: 'richtext',
      title: 'Body',
      data: { query: 'post', path: 'post' },
      field: 'body',
      format: 'markdown',
    },
  ],
};
