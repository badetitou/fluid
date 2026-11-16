// Post-processing for capture.mjs: screenshots to WebP, the recorded WebM to MP4 (with the
// loading stretches cut out), and the MP4 to the animated README preview.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const kb = (path) => `${Math.round(statSync(path).size / 1024)} KB`;

/** PNG screenshot → WebP (quality 85), removing the PNG. */
export function toWebp(png) {
  const webp = png.replace(/\.png$/, '.webp');
  run('cwebp', ['-quiet', '-q', '85', '-m', '6', png, '-o', webp]);
  rmSync(png);
  console.log(`  ${webp} (${kb(webp)})`);
  return webp;
}

/**
 * Time ranges of the recording to drop ([start, end] in seconds, as logged by the
 * scenario): the page loading, spinners, views that are not the point of the demo.
 */
export class Cuts {
  constructor() {
    this.ranges = [];
    this.open = null;
  }
  start(t) {
    this.open = t;
  }
  end(t) {
    if (this.open !== null && t - this.open > 0.05) this.ranges.push([this.open, t]);
    this.open = null;
  }
  /** Where recording time `t` lands in the cut video. */
  outputTime(t) {
    return this.ranges.reduce((acc, [a, b]) => acc - Math.max(0, Math.min(t, b) - a), t);
  }
  /** ffmpeg filter keeping everything outside the ranges, at 25 fps. */
  filter() {
    const drop = this.ranges.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+');
    return drop ? `fps=25,select='not(${drop})',setpts=N/25/TB` : 'fps=25';
  }
}

/** Playwright's WebM → H.264 MP4 (faststart), without the `cuts`. */
export function toMp4(webm, mp4, cuts) {
  run('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', webm, '-vf', cuts.filter(),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', mp4,
  ]);
  console.log(`  ${mp4} (${kb(mp4)})`);
}

/**
 * MP4 → animated WebP preview (12 fps, 960 px wide): the part from `startSec`,
 * sped up by `speed`, so the README shows the highlight rather than the whole session.
 */
export function toPreview(mp4, webp, tmpDir, { startSec = 0, fps = 12, width = 960, speed = 1.5, quality = 50 } = {}) {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  run('ffmpeg', [
    '-loglevel', 'error', '-ss', startSec.toFixed(2), '-i', mp4,
    '-vf', `setpts=PTS/${speed},fps=${fps},scale=${width}:-2:flags=lanczos`,
    join(tmpDir, 'f%05d.png'),
  ]);
  const frames = readdirSync(tmpDir).filter((f) => f.endsWith('.png')).sort().map((f) => join(tmpDir, f));
  const frameMs = String(Math.round(1000 / fps));
  run('img2webp', ['-loop', '0', '-lossy', '-q', String(quality), '-m', '4', '-d', frameMs, ...frames, '-o', webp]);
  rmSync(tmpDir, { recursive: true, force: true });
  console.log(`  ${webp} (${kb(webp)}, ${frames.length} frames)`);
}
