import { useEffect, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { Element3d } from './sceneModel';
import type { Viewport } from './viewport';

/** How an element is drawn. */
export interface ElementStyle {
  color: string;
  /** 1 opaque; below, the element is see-through. */
  opacity: number;
}

/** Faces meeting at a sharper angle than this (degrees) get an edge line. */
const EDGE_ANGLE = 25;

export type ElementMesh = Mesh<BufferGeometry, MeshStandardMaterial>;

/** The element a mesh draws. */
export const elementOf = (mesh: { userData: Record<string, unknown> }) => mesh.userData.element as Element3d;

function buildMesh(element: Element3d, edgeColor?: string): ElementMesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(element.positions, 3));
  geometry.computeVertexNormals();
  // Offset the faces back a little so that coplanar edges and faces do not flicker.
  const material = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const mesh = new Mesh(geometry, material);
  mesh.userData.element = element;
  if (edgeColor) mesh.add(new LineSegments(new EdgesGeometry(geometry, EDGE_ANGLE), new LineBasicMaterial({ color: edgeColor })));
  return mesh;
}

function disposeMesh(mesh: ElementMesh): void {
  mesh.geometry.dispose();
  mesh.material.dispose();
  for (const child of mesh.children) {
    if (child instanceof LineSegments) {
      child.geometry.dispose();
      (child.material as LineBasicMaterial).dispose();
    }
  }
}

/** One mesh per element in the viewport's scene, styled by `styleOf`; restyling does not rebuild them. */
export function useElementMeshes(
  viewport: Viewport | null,
  elements: Element3d[],
  styleOf: (element: Element3d) => ElementStyle,
  edgeColor?: string,
): ElementMesh[] {
  const [meshes, setMeshes] = useState<ElementMesh[]>([]);

  useEffect(() => {
    if (!viewport) return;
    const group = new Group();
    const built = elements.map((e) => buildMesh(e, edgeColor));
    if (built.length > 0) group.add(...built);
    viewport.scene.add(group);
    setMeshes(built);
    return () => {
      viewport.scene.remove(group);
      built.forEach(disposeMesh);
      setMeshes([]);
      viewport.render();
    };
  }, [viewport, elements, edgeColor]);

  useEffect(() => {
    for (const mesh of meshes) {
      const { color, opacity } = styleOf(elementOf(mesh));
      const material = mesh.material;
      material.color.setStyle(color);
      material.opacity = opacity;
      material.transparent = opacity < 1;
      // See-through elements must not hide what is behind them.
      material.depthWrite = opacity >= 1;
      mesh.renderOrder = opacity < 1 ? 1 : 0;
      for (const child of mesh.children) child.visible = opacity >= 1;
    }
    viewport?.render();
  }, [viewport, meshes, styleOf]);

  return meshes;
}
