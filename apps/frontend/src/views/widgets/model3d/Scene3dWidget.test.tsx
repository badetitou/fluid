import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Scene, type Object3D } from 'three';
import { wall3dExample, type Model3dWidget as Model3dSpec, type Scene3dWidget as Scene3dSpec } from '@fluid/shared';
import { Model3dWidget } from './Model3dWidget';
import { Scene3dWidget } from './Scene3dWidget';
import { elementOf, type ElementMesh } from './useElementMeshes';
import { port, terminal, wall } from './ifcFixtures';

// jsdom has no WebGL: the viewport is replaced by one that only keeps the scene.
const fake = vi.hoisted(() => ({ picked: 0, frame: vi.fn() }));
vi.mock('./viewport', () => ({
  Viewport: class {
    scene = new Scene();
    canvas = document.createElement('canvas');
    constructor(container: HTMLElement) {
      container.appendChild(this.canvas);
    }
    render() {}
    frame = fake.frame;
    pick = (_x: number, _y: number, objects: Object3D[]) => objects[fake.picked];
    dispose() {
      this.canvas.remove();
    }
  },
}));

const [modelSpec, sceneSpec] = wall3dExample.widgets as [Model3dSpec, Scene3dSpec];

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const inRouter = (node: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/d/IfcWallStandardCase']}>
      <Routes>
        <Route path="*" element={<>{node}<Location /></>} />
      </Routes>
    </MemoryRouter>,
  );

/** The meshes the widget put in the scene of the last framed viewport, by element id. */
function sceneMeshes(): Map<string, ElementMesh> {
  const scene = (fake.frame.mock.contexts.at(-1) as { scene: Scene }).scene;
  const meshes = new Map<string, ElementMesh>();
  scene.traverse((o) => {
    if (o.userData.element) meshes.set(elementOf(o).id!, o as ElementMesh);
  });
  return meshes;
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  fake.frame.mockClear();
});

describe('Scene3dWidget', () => {
  const renderScene = (widget = sceneSpec, emit = vi.fn()) => {
    const highlight = { ifcWallStandardCase: wall };
    inRouter(<Scene3dWidget widget={widget} data={[wall, terminal, port]} resolve={(b) => highlight[b.path as 'ifcWallStandardCase']} emit={emit} />);
    return emit;
  };

  it('draws the elements with geometry, the highlighted one opaque and the others faded', () => {
    renderScene();
    const meshes = sceneMeshes();
    expect([...meshes.keys()]).toEqual(['inst:wall', 'inst:terminal']);
    expect(meshes.get('inst:wall')!.material.opacity).toBe(1);
    expect(meshes.get('inst:terminal')!.material.opacity).toBe(0.25);
    expect(fake.frame).toHaveBeenLastCalledWith({ min: [0, 0, 0], max: [14, 6, 5] });
  });

  it('frames the highlighted elements when asked', () => {
    renderScene({ ...sceneSpec, focusHighlight: true });
    expect(fake.frame).toHaveBeenLastCalledWith({ min: [10, 0, 1], max: [14, expect.closeTo(0.2), 4] });
  });

  it('emits the clicked element and opens it in its own concept', () => {
    fake.picked = 1;
    const emit = renderScene();
    const canvas = document.querySelector('canvas')!;
    act(() => {
      fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
      fireEvent.pointerUp(canvas, { clientX: 6, clientY: 5 });
    });
    expect(emit).toHaveBeenCalledWith('selected', terminal);
    expect(screen.getByTestId('location').textContent).toBe('/d/IfcWallStandardCase/IfcFlowTerminal@inst%3Aterminal');
  });

  it('does not select when the camera was dragged', () => {
    const emit = renderScene();
    const canvas = document.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerUp(canvas, { clientX: 60, clientY: 5 });
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('Model3dWidget', () => {
  it('draws the element alone, framed', () => {
    inRouter(<Model3dWidget widget={modelSpec} data={wall} />);
    expect(fake.frame).toHaveBeenLastCalledWith({ min: [10, 0, 1], max: [14, expect.closeTo(0.2), 4] });
    expect(screen.queryByText('No geometry')).toBeNull();
  });

  it('says so when the data has no geometry', () => {
    inRouter(<Model3dWidget widget={modelSpec} data={port} />);
    expect(screen.getByText('No geometry')).toBeTruthy();
  });
});
