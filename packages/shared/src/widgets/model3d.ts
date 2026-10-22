import { z } from 'zod';
import { dataBindingSchema, linkToSchema, widgetBase } from './common';

/**
 * 3D widgets drawing building elements (IFC products) with three.js.
 *
 * Both read IFC products as an ifcOWL GraphQL API exposes them: each product's
 * `objectPlacement` (nested local placements) and `representation` (shape
 * representations whose items are faceted B-reps, extruded profiles, bounding
 * boxes or mapped items). The selection to query is `IFC_GEOMETRY_FRAGMENTS`.
 *
 * - `model3d` shows the given element(s) on their own, framed by the camera.
 * - `scene3d` shows a whole model and highlights some of its elements (the
 *   item of a detail view, or another widget's selection); clicking an element
 *   selects it (`selected` output) and opens it when `linkTo` is set.
 */
const model3dFields = {
  ...widgetBase,
  /** IFC product(s): one object or a list. */
  data: dataBindingSchema,
  /** Dot path of an element's text, shown on hover (default: name, then the type). */
  labelField: z.string().min(1).optional(),
  /** Dot path of the category coloring the elements (default `__typename`, the IFC class). */
  colorField: z.string().min(1).optional(),
  /** Representation drawn, by `representationIdentifier` (default "Body", then any solid one). */
  representation: z.string().min(1).optional(),
  /** Draw the edges of the faces over the solids. */
  edges: z.boolean().optional(),
};

export const model3dWidgetSchema = z.object({
  type: z.literal('model3d'),
  ...model3dFields,
});
export type Model3dWidget = z.infer<typeof model3dWidgetSchema>;

export const scene3dWidgetSchema = z.object({
  type: z.literal('scene3d'),
  ...model3dFields,
  /** The element(s) to highlight: one object, a list, or ids. */
  highlight: dataBindingSchema.optional(),
  /** Dot path of an element's id, matched against the highlighted ones (default `_id`, then `id`). */
  idField: z.string().min(1).optional(),
  /** Opacity of the elements that are not highlighted, 0.05..1 (default 0.25). */
  contextOpacity: z.number().min(0.05).max(1).optional(),
  /** Frame the camera on the highlighted elements instead of the whole model (default false). */
  focusHighlight: z.boolean().optional(),
  /** IFC classes left out of the scene (default: IfcOpeningElement, IfcSpace). */
  hiddenTypes: z.array(z.string().min(1)).optional(),
  /** Opens the clicked element in a new column. */
  linkTo: linkToSchema.optional(),
  /** Dot path of the clicked element's concept, overriding `linkTo.concept` (e.g. `__typename`). */
  conceptField: z.string().min(1).optional(),
});
export type Scene3dWidget = z.infer<typeof scene3dWidgetSchema>;

/**
 * The fragments to select a product's geometry with, on an ifcOWL GraphQL API.
 * Append them to the query and spread `...IfcGeometry` in each product, e.g.
 * `{ allIfcProduct(limit: 1000) { __typename _id name ...IfcGeometry } }`.
 */
export const IFC_GEOMETRY_FRAGMENTS = /* GraphQL */ `
fragment IfcAxis3 on IfcAxis2Placement3D { location { coordinates } axis { directionRatios } refDirection { directionRatios } }
fragment IfcAxis2 on IfcAxis2Placement2D { location { coordinates } refDirection { directionRatios } }
fragment IfcPlacement on IfcLocalPlacement { relativePlacement { ...IfcAxis3 } }
fragment IfcProfile on IfcProfileDefInterface { __typename
  ... on IfcRectangleProfileDef { xDim yDim position { ...IfcAxis2 } }
  ... on IfcRectangleHollowProfileDef { wallThickness }
  ... on IfcCircleProfileDef { radius position { ...IfcAxis2 } }
  ... on IfcCircleHollowProfileDef { wallThickness }
  ... on IfcArbitraryClosedProfileDef { outerCurve { ... on IfcPolyline { points { coordinates } } } }
  ... on IfcArbitraryProfileDefWithVoids { innerCurves { ... on IfcPolyline { points { coordinates } } } } }
fragment IfcSolid on IfcRepresentationItemInterface { __typename
  ... on IfcFacetedBrep { outer { cfsFaces { bounds { __typename bound { ... on IfcPolyLoop { polygon { coordinates } } } } } } }
  ... on IfcExtrudedAreaSolid { depth extrudedDirection { directionRatios } position { ...IfcAxis3 } sweptArea { ...IfcProfile } }
  ... on IfcBoundingBox { corner { coordinates } xDim yDim zDim } }
fragment IfcGeometry on IfcProductInterface {
  objectPlacement { ...IfcPlacement ... on IfcLocalPlacement { placementRelTo { ...IfcPlacement ... on IfcLocalPlacement {
    placementRelTo { ...IfcPlacement ... on IfcLocalPlacement { placementRelTo { ...IfcPlacement ... on IfcLocalPlacement {
    placementRelTo { ...IfcPlacement ... on IfcLocalPlacement { placementRelTo { ...IfcPlacement ... on IfcLocalPlacement {
    placementRelTo { ...IfcPlacement } } } } } } } } } } } } }
  representation { representations { representationIdentifier items { ...IfcSolid
    ... on IfcMappedItem {
      mappingTarget {
        ... on IfcCartesianTransformationOperator3DInterface { localOrigin { coordinates } axis1 { directionRatios } axis2 { directionRatios } axis3 { directionRatios } scale }
        ... on IfcCartesianTransformationOperator3DnonUniform { scale2 scale3 } }
      mappingSource { mappingOrigin { ... on IfcAxis2Placement3D { ...IfcAxis3 } } mappedRepresentation { items { ...IfcSolid } } } } } } } }
`;

const common3dDoc = `"data": { "query": ..., "path"?: ... }, "labelField"?: string, "colorField"?: string,
    "representation"?: string, "edges"?: boolean`;

const geometryDoc = `    ONLY for IFC / BIM sources (ifcOWL types such as IfcWall, IfcSlab, IfcProduct). Each element must be
    selected with the IfcGeometry fragment: write "{ <field> { __typename _id name ...IfcGeometry } }" and append
    this text VERBATIM after the operation, in the same query document:
${IFC_GEOMETRY_FRAGMENTS.trim()}`;

/** How the LLM is told to use the model3d widget. */
export const model3dWidgetDoc = `- { "id": string, "type": "model3d", "title"?: string, "span"?: 1..24, "height"?: number,
    ${common3dDoc} }
    Use it to show ONE building element (or a few) in 3D, on its own, e.g. the wall of a detail view
    (query "ifcWallStandardCase(_id: $id)"). The user turns around it with the mouse.
${geometryDoc}`;

/** How the LLM is told to use the scene3d widget. */
export const scene3dWidgetDoc = `- { "id": string, "type": "scene3d", "title"?: string, "span"?: 1..24, "height"?: number,
    ${common3dDoc}, "highlight"?: { "query": ..., "path"?: ... }, "idField"?: string,
    "contextOpacity"?: number, "focusHighlight"?: boolean, "hiddenTypes"?: [string, ...], "linkTo"?: LinkConfig,
    "conceptField"?: string }
    Use it to show a WHOLE building in 3D and HIGHLIGHT some of its elements in it: "data" is every product
    ("allIfcProduct(limit: 1000)"), "highlight" the element(s) to stand out: on a detail view, a second query
    "query($id: ID!) { <byIdField>(_id: $id) { _id } }"; or another widget's selection ("@<widgetId>", path
    "selected"). Elements match by "_id". Clicking an element emits "selected"; set "linkTo" (idField "_id") and
    "conceptField": "__typename" so it opens in its own concept (walls, slabs…). The same IfcGeometry fragment as model3d is required in "data" (not in "highlight").`;

