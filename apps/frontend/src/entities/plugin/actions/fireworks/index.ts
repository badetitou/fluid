import type { PageAction } from '../../pageAction';
import { createShow, isOver, opacityOf, step } from './model';

const ROCKETS = 9;
/** Longest frame step, so a background tab does not teleport the sparks. */
const MAX_DT = 1 / 20;

/**
 * Plays a fireworks show over the whole page, in the theme's palette, on a
 * canvas that lets clicks through and removes itself once the last spark is out.
 */
export function playFireworks(palette: readonly string[]): void {
  const canvas = document.createElement('canvas');
  const ratio = window.devicePixelRatio || 1;
  const { innerWidth: width, innerHeight: height } = window;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2000',
  });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  document.body.appendChild(canvas);

  let show = createShow(width, height, ROCKETS);
  let last = performance.now();
  const frame = (now: number) => {
    show = step(show, Math.min((now - last) / 1000, MAX_DT), palette, Math.random);
    last = now;
    ctx.clearRect(0, 0, width, height);
    for (const p of show.particles) {
      ctx.globalAlpha = opacityOf(p);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.rocket ? 2.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isOver(show)) canvas.remove();
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** The easter egg: fireworks over any page. */
export const fireworksAction: PageAction = {
  id: 'fireworks',
  label: 'Fireworks',
  description: 'Celebrate: fireworks over the page, in the colours of the theme.',
  icon: '🎆',
  run: ({ palette }) => playFireworks(palette),
};
