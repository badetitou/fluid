// High-quality capture for the demo videos: Chrome's screencast (CDP) at the page's device
// scale factor, instead of Playwright's recordVideo (viewport size, low bitrate).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Start saving every painted frame of `page` as a JPEG in `dir`, with its time. */
export async function startScreencast(page, dir, { width, height, quality = 95 }) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(dir, `f${String(frames.length).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  return {
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      return frames;
    },
  };
}

/**
 * Frames → H.264 MP4 at `fps`, without the `cuts` (times relative to `startedSec`, epoch seconds).
 * Each frame lasts until the next one; the last one until `endSec` (relative, like the cuts).
 */
export function framesToMp4(frames, mp4, { cuts, startedSec, endSec, fps = 30, crf = 16, width, height }) {
  const all = frames.map((f) => ({ ...f, rel: f.t - startedSec }));
  const inCut = (rel) => cuts.ranges.some(([a, b]) => rel >= a && rel < b);
  // Chrome sends a frame only when the page repaints: what a cut ends on may have been painted
  // inside the cut, so its last frame is shown from the end of the cut.
  const carried = cuts.ranges.flatMap(([, b]) => {
    const last = all.filter((f) => f.rel < b).pop();
    return last && inCut(last.rel) ? [{ ...last, rel: b }] : [];
  });
  const kept = [...all.filter((f) => !inCut(f.rel)), ...carried]
    .sort((x, y) => x.rel - y.rel)
    .map((f) => ({ ...f, out: cuts.outputTime(f.rel) }));
  const holdSec = Math.max(cuts.outputTime(endSec) - (kept.at(-1)?.out ?? 0), 0.5);
  if (!kept.length) throw new Error('No frame captured');
  const lines = ['ffconcat version 1.0'];
  kept.forEach((f, i) => {
    const next = kept[i + 1];
    const duration = next ? Math.max(next.out - f.out, 0.001) : holdSec;
    lines.push(`file '${f.file}'`, `duration ${duration.toFixed(4)}`);
  });
  lines.push(`file '${kept[kept.length - 1].file}'`);
  const list = `${mp4}.ffconcat`;
  writeFileSync(list, lines.join('\n'));
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${width}:${height}:flags=lanczos,fps=${fps}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-tune', 'stillimage',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  rmSync(list);
  console.log(`  ${mp4} (${Math.round(statSync(mp4).size / 1024)} KB, ${kept.length} frames)`);
}
