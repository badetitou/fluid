import { z } from 'zod';
import { provenanceCountsSchema } from './model';

/** The one Model field needed to know whether SCIP resolved any relation. */
export const MODEL_RESOLUTION_QUERY = /* GraphQL */ `
  query ModelResolution {
    analysis {
      metrics {
        relationsByProvenance
      }
    }
  }
`;

export const modelResolutionSchema = z.object({
  analysis: z.object({
    metrics: z.object({ relationsByProvenance: provenanceCountsSchema }),
  }),
});

export type RawModelResolution = z.infer<typeof modelResolutionSchema>;
