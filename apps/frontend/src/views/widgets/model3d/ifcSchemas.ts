import { z } from 'zod';

// The IFC entities the 3D widgets read, as the IfcGeometry fragment selects them
// (see `IFC_GEOMETRY_FRAGMENTS` in @fluid/shared). Every field is optional:
// what is missing falls back to the IFC default (identity placement, unit axes).

const coords = z.array(z.number());
const point = z.object({ coordinates: coords }).nullish();
const direction = z.object({ directionRatios: coords }).nullish();

export const axis3Schema = z.object({ location: point, axis: direction, refDirection: direction });
export type Axis3 = z.infer<typeof axis3Schema>;

export const axis2Schema = z.object({ location: point, refDirection: direction });
export type Axis2 = z.infer<typeof axis2Schema>;

export interface LocalPlacement {
  relativePlacement?: Axis3 | null;
  placementRelTo?: LocalPlacement | null;
}
export const localPlacementSchema: z.ZodType<LocalPlacement> = z.lazy(() =>
  z.object({ relativePlacement: axis3Schema.nullish(), placementRelTo: localPlacementSchema.nullish() }),
);

const polyline = z.object({ points: z.array(z.object({ coordinates: coords })) });

export const profileSchema = z.object({
  __typename: z.string(),
  xDim: z.number().nullish(),
  yDim: z.number().nullish(),
  radius: z.number().nullish(),
  wallThickness: z.number().nullish(),
  position: axis2Schema.nullish(),
  outerCurve: polyline.partial().nullish(),
  innerCurves: z.array(polyline.partial()).nullish(),
});
export type Profile = z.infer<typeof profileSchema>;

const faceSchema = z.object({
  bounds: z.array(
    z.object({
      __typename: z.string().optional(),
      bound: z.object({ polygon: z.array(z.object({ coordinates: coords })).optional() }).nullish(),
    }),
  ),
});
export type Face = z.infer<typeof faceSchema>;

export const brepSchema = z.object({
  __typename: z.literal('IfcFacetedBrep'),
  outer: z.object({ cfsFaces: z.array(faceSchema) }),
});

export const extrusionSchema = z.object({
  __typename: z.literal('IfcExtrudedAreaSolid'),
  depth: z.number(),
  extrudedDirection: direction,
  position: axis3Schema.nullish(),
  sweptArea: profileSchema,
});
export type Extrusion = z.infer<typeof extrusionSchema>;

export const boxSchema = z.object({
  __typename: z.literal('IfcBoundingBox'),
  corner: point,
  xDim: z.number(),
  yDim: z.number(),
  zDim: z.number(),
});
export type Box = z.infer<typeof boxSchema>;

export const transformOperatorSchema = z.object({
  localOrigin: point,
  axis1: direction,
  axis2: direction,
  axis3: direction,
  scale: z.number().nullish(),
  scale2: z.number().nullish(),
  scale3: z.number().nullish(),
});
export type TransformOperator = z.infer<typeof transformOperatorSchema>;

export const mappedItemSchema = z.object({
  __typename: z.literal('IfcMappedItem'),
  mappingTarget: transformOperatorSchema.nullish(),
  mappingSource: z.object({
    mappingOrigin: axis3Schema.nullish(),
    mappedRepresentation: z.object({ items: z.array(z.unknown()) }),
  }),
});

export const representationSchema = z.object({
  representationIdentifier: z.string().nullish(),
  items: z.array(z.unknown()),
});

export const productSchema = z.object({
  objectPlacement: localPlacementSchema.nullish(),
  representation: z.object({ representations: z.array(representationSchema) }).nullish(),
});
export type Product = z.infer<typeof productSchema>;
