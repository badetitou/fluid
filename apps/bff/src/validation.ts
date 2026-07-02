import { z } from 'zod';
import { viewSpecSchema } from '@fluid/shared';

// Request body schemas for the views API. The view spec itself is validated
// with the shared zod schema so the BFF stores canonical, valid specs.

export const createViewBody = z.object({
  spec: viewSpecSchema,
  isDefault: z.boolean().optional(),
});
export type CreateViewBody = z.infer<typeof createViewBody>;

export const updateViewBody = z
  .object({
    spec: viewSpecSchema.optional(),
    title: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((v) => v.spec !== undefined || v.title !== undefined || v.isDefault !== undefined, {
    message: 'Provide at least one of: spec, title, isDefault.',
  });
export type UpdateViewBody = z.infer<typeof updateViewBody>;
