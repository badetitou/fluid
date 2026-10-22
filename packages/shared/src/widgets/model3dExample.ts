import type { ViewSpec } from '../view-spec';
import { IFC_GEOMETRY_FRAGMENTS } from './model3d';

/**
 * A curated detail view of an IFC wall (ifcOWL GraphQL API, e.g. IFCtoRDF data
 * served by a typed GraphQL layer): the wall alone, and the wall in its building.
 */
export const wall3dExample: ViewSpec = {
  version: 1,
  id: 'builtin:ifc-wall-3d',
  concept: 'IfcWallStandardCase',
  scope: 'detail',
  title: 'Wall in 3D',
  description: 'The wall on its own, and highlighted in the whole building.',
  queries: {
    wall: {
      query: /* GraphQL */ `
        query FluidWall3d($id: ID!) {
          ifcWallStandardCase(_id: $id) { __typename _id name ...IfcGeometry }
        }
        ${IFC_GEOMETRY_FRAGMENTS}
      `,
    },
    building: {
      query: /* GraphQL */ `
        query FluidBuilding3d {
          allIfcProduct(limit: 1000) { __typename _id name ...IfcGeometry }
        }
        ${IFC_GEOMETRY_FRAGMENTS}
      `,
    },
  },
  widgets: [
    {
      id: 'wall',
      type: 'model3d',
      title: 'Wall',
      span: 8,
      height: 360,
      data: { query: 'wall', path: 'ifcWallStandardCase' },
      edges: true,
    },
    {
      id: 'building',
      type: 'scene3d',
      title: 'In the building',
      span: 16,
      height: 360,
      data: { query: 'building', path: 'allIfcProduct' },
      highlight: { query: 'wall', path: 'ifcWallStandardCase' },
      linkTo: { concept: 'IfcWallStandardCase', idField: '_id' },
      conceptField: '__typename',
    },
  ],
};
