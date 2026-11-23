import { z } from 'zod';

/**
 * What Model's `Query.analysis` says about the whole model: dependency cycles (not counting a
 * method that only calls itself), isolated classes and methods, and the most connected entities. Servers older than the analysis fields reject it.
 */
export const ANALYSIS_QUERY = /* GraphQL */ `
  query ModelAnalysis {
    analysis {
      cycles {
        count(minSize: 2)
        cyclicEntities(minSize: 2)
        components(minSize: 2, first: 20) {
          size
          entities(first: 6) {
            name
          }
        }
      }
      isolatedClasses: unused(kind: CLASS, first: 50) {
        totalCount
        nodes {
          key
          name
          fineKind
          file
        }
      }
      isolatedMethods: unused(kind: METHOD, first: 50) {
        totalCount
        nodes {
          key
          name
          fineKind
          file
        }
      }
      mostConnected(first: 10) {
        key
        name
        fineKind
        file
        inDegree
        outDegree
      }
    }
  }
`;

const entitySchema = z.object({ key: z.string(), name: z.string(), fineKind: z.string(), file: z.string().nullable() });

const isolatedSchema = z.object({ totalCount: z.number(), nodes: z.array(entitySchema) });

export const analysisSchema = z.object({
  analysis: z.object({
    cycles: z.object({
      count: z.number(),
      cyclicEntities: z.number(),
      components: z.array(z.object({ size: z.number(), entities: z.array(z.object({ name: z.string() })) })),
    }),
    isolatedClasses: isolatedSchema,
    isolatedMethods: isolatedSchema,
    mostConnected: z.array(entitySchema.extend({ inDegree: z.number(), outDegree: z.number() })),
  }),
});

export type RawAnalysis = z.infer<typeof analysisSchema>['analysis'];
