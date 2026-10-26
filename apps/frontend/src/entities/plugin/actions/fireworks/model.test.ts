import { describe, expect, it } from 'vitest';
import { burst, createShow, isOver, launchRocket, opacityOf, step } from './model';

const PALETTE = ['#ff0000', '#00ff00', '#0000ff'];
/** A fixed sequence, so the show is the same at every run. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('fireworks', () => {
  it('launches rockets from the bottom of the page, in the palette', () => {
    const show = createShow(800, 600, 3);
    const rocket = launchRocket(show, PALETTE, seeded());
    expect(rocket.y).toBe(600);
    expect(rocket.vy).toBeLessThan(0);
    expect(rocket.x).toBeGreaterThan(0);
    expect(rocket.x).toBeLessThan(800);
    expect(PALETTE).toContain(rocket.color);
  });

  it('bursts a rocket into sparks around it', () => {
    const rocket = { ...launchRocket(createShow(800, 600, 1), PALETTE, seeded()), x: 100, y: 200 };
    const sparks = burst(rocket, PALETTE, seeded(2));
    expect(sparks.length).toBeGreaterThan(10);
    expect(sparks.every((s) => !s.rocket && s.x === 100 && s.y === 200)).toBe(true);
    expect(new Set(sparks.map((s) => Math.sign(s.vx))).size).toBeGreaterThan(1);
  });

  it('plays every rocket, bursts them in the upper part of the page, then ends', () => {
    const random = seeded(3);
    let show = createShow(800, 600, 4);
    let sparksSeen = false;
    let highest = 600;
    for (let t = 0; t < 20 && !isOver(show); t += 1 / 60) {
      show = step(show, 1 / 60, PALETTE, random);
      for (const p of show.particles) if (p.rocket) highest = Math.min(highest, p.y);
      sparksSeen ||= show.particles.some((p) => !p.rocket);
    }
    expect(sparksSeen).toBe(true);
    expect(highest).toBeLessThan(400);
    expect(isOver(show)).toBe(true);
  });

  it('fades sparks as they age, never rockets', () => {
    const [spark] = burst(
      launchRocket(createShow(800, 600, 1), PALETTE, seeded()),
      PALETTE,
      seeded(),
    );
    expect(opacityOf(spark)).toBe(1);
    expect(opacityOf({ ...spark, life: spark.span / 2 })).toBeCloseTo(0.5);
    expect(opacityOf({ ...spark, rocket: true, life: 0.01 })).toBe(1);
  });
});
