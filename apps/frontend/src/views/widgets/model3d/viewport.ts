import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Bounds } from './sceneModel';

// The three.js side of the 3D widgets, outside React: a renderer drawing into
// a container, an orbiting camera (IFC is Z-up), lights, and picking. It draws
// on demand (camera moved, content changed), not in a loop.

/** A view direction pleasant on buildings: from the front-right, slightly above. */
const VIEW_DIRECTION = new Vector3(1, -1.4, 0.9).normalize();
/** Camera distance relative to the one fitting the box exactly. */
const FRAME_MARGIN = 1.1;

/** The distance from `center`, along the view direction, at which every corner of `box` is in view. */
function fitDistance(box: Box3, center: Vector3, camera: PerspectiveCamera): number {
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  const tanH = tanV * camera.aspect;
  const right = new Vector3().crossVectors(camera.up, VIEW_DIRECTION).normalize();
  const up = new Vector3().crossVectors(VIEW_DIRECTION, right);
  let distance = 0;
  for (let i = 0; i < 8; i++) {
    const corner = new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
    // A corner nearer the camera (toward it by `toward`) needs the camera farther back.
    const toward = corner.dot(VIEW_DIRECTION);
    distance = Math.max(distance, toward + Math.abs(corner.dot(right)) / tanH, toward + Math.abs(corner.dot(up)) / tanV);
  }
  return distance;
}

export class Viewport {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1, 0.01, 1000);
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly resize: ResizeObserver;
  private readonly raycaster = new Raycaster();
  private frameRequest = 0;
  /** What the camera was last framed on, framed again on resize until the user moves the camera. */
  private framed: Bounds | null = null;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener('change', () => this.render());
    this.controls.addEventListener('start', () => {
      this.framed = null;
    });

    this.scene.add(new HemisphereLight(0xffffff, 0x888888, 2));
    const sun = new DirectionalLight(0xffffff, 1.5);
    sun.position.set(0.5, -1, 2);
    this.scene.add(sun);

    this.resize = new ResizeObserver(() => this.fitContainer());
    this.resize.observe(container);
    this.fitContainer();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private fitContainer(): void {
    const { width, height } = this.container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = `${width}px`;
    this.renderer.domElement.style.height = `${height}px`;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.framed) this.frame(this.framed);
    this.render();
  }

  /** Draws on the next frame (several requests in a frame draw once). */
  render(): void {
    if (this.frameRequest) return;
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** Places the camera so that `bounds` fills the view. */
  frame(bounds: Bounds | null): void {
    this.framed = bounds;
    if (!bounds) return;
    const box = new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max));
    const center = box.getCenter(new Vector3());
    const distance = Math.max(fitDistance(box, center, this.camera), 0.01) * FRAME_MARGIN;
    this.camera.position.copy(center).addScaledVector(VIEW_DIRECTION, distance);
    this.camera.near = distance / 100;
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
    this.render();
  }

  /** The nearest of `objects` under the pointer, opaque ones first: see-through ones do not hide what they fade into. */
  pick(clientX: number, clientY: number, objects: Object3D[]): Object3D | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const hits = this.raycaster.intersectObjects(objects, false).filter((hit) => hit.object.visible);
    return (hits.find((hit) => hit.object.renderOrder === 0) ?? hits[0])?.object;
  }

  dispose(): void {
    cancelAnimationFrame(this.frameRequest);
    this.resize.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
