import { z } from 'zod';

/** One page of classes of a Model source, with what the dashboard needs to judge them. */
export const CLASSES_QUERY = /* GraphQL */ `
  query CodeDashboard($after: String) {
    classes(first: 100, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
      nodes {
        key
        name
        file
        external
        fineKind
        range {
          startLine
          endLine
        }
        incoming(first: 1) {
          totalCount
        }
        children(kind: METHOD, first: 300) {
          totalCount
          nodes {
            key
            name
            range {
              startLine
              endLine
            }
            incoming(first: 1) {
              totalCount
            }
          }
        }
      }
    }
  }
`;

const rangeSchema = z.object({ startLine: z.number(), endLine: z.number() }).nullable();
const countSchema = z.object({ totalCount: z.number() });

const methodSchema = z.object({
  key: z.string(),
  name: z.string(),
  range: rangeSchema,
  incoming: countSchema,
});

const classSchema = z.object({
  key: z.string(),
  name: z.string(),
  file: z.string().nullable(),
  external: z.boolean(),
  fineKind: z.string(),
  range: rangeSchema,
  incoming: countSchema,
  children: z.object({ totalCount: z.number(), nodes: z.array(methodSchema) }),
});

export const classesPageSchema = z.object({
  classes: z.object({
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
    totalCount: z.number().optional(),
    nodes: z.array(classSchema),
  }),
});

export type ClassesPage = z.infer<typeof classesPageSchema>;
export type RawClass = ClassesPage['classes']['nodes'][number];
