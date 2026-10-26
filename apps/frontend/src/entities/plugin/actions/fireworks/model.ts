// The pure half of the fireworks: rockets rise, burst into sparks that fall and
// fade. Positions are in pixels, times in seconds; `random` is injected for tests.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  /** Seconds left; a rocket bursts when it reaches 0, a spark disappears. */
  life: number;
  /** Its life at birth, for the fade. */
  span: number;
  rocket: boolean;
}

export interface Show {
  width: number;
  height: number;
  particles: Particle[];
  /** Rockets still to launch, and the delay before the next one. */
  pending: number;
  nextIn: number;
}

const GRAVITY = 220;
/** Air slows sparks down (velocity kept per second); rockets fly freely. */
const DRAG = 0.4;
const SPARKS = 48;
const LAUNCH_EVERY = 0.35;

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length) % items.length];

/** A show of `rockets` rockets over a `width` × `height` page. */
export function createShow(width: number, height: number, rockets: number): Show {
  return { width, height, particles: [], pending: rockets, nextIn: 0 };
}

/** A rocket leaving the bottom of the page, bursting in its upper half. */
export function launchRocket(show: Show, palette: readonly string[], random: () => number): Particle {
  const life = 0.9 + random() * 0.5;
  // Reaches about 15 – 55 % of the height when it bursts.
  const rise = show.height * (0.45 + random() * 0.4);
  return {
    x: show.width * (0.15 + random() * 0.7),
    y: show.height,
    vx: (random() - 0.5) * 80,
    vy: -(rise / life + (GRAVITY * life) / 2),
    color: pick(palette, random),
    life,
    span: life,
    rocket: true,
  };
}

/** The sparks of a rocket bursting where it is, in a ring with some jitter. */
export function burst(rocket: Particle, palette: readonly string[], random: () => number): Particle[] {
  return Array.from({ length: SPARKS }, (_, i) => {
    const angle = (i / SPARKS) * Math.PI * 2 + random() * 0.2;
    const speed = 120 + random() * 160;
    const life = 1 + random() * 0.8;
    return {
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: random() < 0.7 ? rocket.color : pick(palette, random),
      life,
      span: life,
      rocket: false,
    };
  });
}

/** Moves the show on by `dt` seconds: launches, moves, bursts and drops particles. */
export function step(show: Show, dt: number, palette: readonly string[], random: () => number): Show {
  let { pending, nextIn } = show;
  const launched: Particle[] = [];
  nextIn -= dt;
  while (pending > 0 && nextIn <= 0) {
    launched.push(launchRocket(show, palette, random));
    pending -= 1;
    nextIn += LAUNCH_EVERY * (0.5 + random());
  }
  const drag = DRAG ** dt;
  const particles = [...show.particles, ...launched].flatMap((p) => {
    const slow = p.rocket ? 1 : drag;
    const moved = {
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vx: p.vx * slow,
      vy: p.vy * slow + GRAVITY * dt,
      life: p.life - dt,
    };
    if (moved.life > 0) return [moved];
    return p.rocket ? burst(moved, palette, random) : [];
  });
  return { ...show, particles, pending, nextIn };
}

/** The show is over: nothing left to launch or to see. */
export const isOver = (show: Show): boolean => show.pending === 0 && show.particles.length === 0;

/** How visible a particle still is, from 1 (just born) to 0. */
export const opacityOf = (p: Particle): number => (p.rocket ? 1 : Math.max(0, Math.min(1, p.life / p.span)));
