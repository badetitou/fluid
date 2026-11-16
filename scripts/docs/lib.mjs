// Helpers for capture.mjs: LLM fixtures (record / replay), flaky-API retries,
// cleanup of the views a run saved, and ffmpeg / cwebp post-processing.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const GENERATE_ROUTE = '**/api/llm/generate-view/stream';
export const CONFIG_ROUTE = '**/api/llm/config';
const RICK_AND_MORTY = 'https://rickandmortyapi.com/graphql';

/**
 * Serve the assistant from recorded fixtures (replay) or record them from the
 * real provider (record). `use(name)` names the fixture the next generation
 * reads or writes, so the scenario stays explicit about which answer it gets.
 */
export function llmFixtures(fixturesDir, { record, delayMs = 3500 }) {
  let next = null;
  const file = (name) => join(fixturesDir, `${name}.sse`);

  async function install(context) {
    await context.route(CONFIG_ROUTE, async (route) => {
      const path = join(fixturesDir, 'llm-config.json');
      if (record) {
        const res = await route.fetch();
        writeFileSync(path, `${JSON.stringify(await res.json(), null, 2)}\n`);
        return route.fulfill({ response: res });
      }
      if (!existsSync(path)) return route.continue();
      return route.fulfill({ contentType: 'application/json', body: readFileSync(path, 'utf8') });
    });
    await context.route(GENERATE_ROUTE, async (route) => {
      if (!next) throw new Error('A generation started without a fixture name (call use() first)');
      const name = next;
      next = null;
      if (record) {
        const res = await route.fetch({ timeout: 600_000 });
        const body = await res.text();
        writeFileSync(file(name), body);
        console.log(`  recorded ${name}.sse (${body.length} bytes)`);
        return route.fulfill({ response: res, body });
      }
      // Leave the "working" state on screen for a moment, as a real model would.
      await new Promise((r) => setTimeout(r, delayMs));
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
        body: readFileSync(file(name), 'utf8'),
      });
    });
  }

  return {
    install,
    use: (name) => {
      if (!record && !existsSync(file(name))) {
        throw new Error(`Missing fixture ${file(name)}: run with --record first`);
      }
      next = name;
    },
  };
}

/** The public Rick and Morty API sometimes answers 413: retry a few times. */
export async function retryFlakyApi(context) {
  await context.route(RICK_AND_MORTY, async (route) => {
    for (let attempt = 0; ; attempt += 1) {
      const res = await route.fetch().catch(() => null);
      if (res && (res.ok() || attempt >= 4)) return route.fulfill({ response: res });
      if (!res && attempt >= 4) return route.abort();
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  });
}

/** Spec titles of the recorded generations, i.e. the views a run saves. */
export function fixtureTitles(fixturesDir) {
  if (!existsSync(fixturesDir)) return [];
  return readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.sse'))
    .map((f) => {
      const text = readFileSync(join(fixturesDir, f), 'utf8');
      const result = text.split('\n\n').find((b) => b.startsWith('event: result'));
      return result ? JSON.parse(result.slice(result.indexOf('data: ') + 6)).spec.title : null;
    })
    .filter(Boolean);
}

/** Delete the views earlier runs saved from the fixtures, so every run starts the same. */
export async function deleteSavedViews(baseUrl, titles) {
  const res = await fetch(`${baseUrl}/api/views`);
  if (!res.ok) throw new Error(`GET /api/views → ${res.status}: is the app running at ${baseUrl}?`);
  const views = await res.json();
  for (const view of views) {
    if (titles.includes(view.spec?.title) || titles.includes(view.title)) {
      await fetch(`${baseUrl}/api/views/${encodeURIComponent(view.id)}`, { method: 'DELETE' });
    }
  }
}

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

/** Playwright's WebM → H.264 MP4 (faststart), skipping the first `trimSec` seconds. */
export function toMp4(webm, mp4, trimSec) {
  run('ffmpeg', [
    '-y', '-loglevel', 'error', '-ss', trimSec.toFixed(2), '-i', webm,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-r', '25', '-movflags', '+faststart', '-an', mp4,
  ]);
  console.log(`  ${mp4} (${kb(mp4)})`);
}

/** MP4 → animated WebP preview (12 fps, 960 px wide), sped up by `speed`. */
export function toPreview(mp4, webp, tmpDir, { fps = 12, width = 960, speed = 1, quality = 50 } = {}) {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  run('ffmpeg', [
    '-loglevel', 'error', '-i', mp4,
    '-vf', `setpts=PTS/${speed},fps=${fps},scale=${width}:-2:flags=lanczos`,
    join(tmpDir, 'f%05d.png'),
  ]);
  const frames = readdirSync(tmpDir).filter((f) => f.endsWith('.png')).sort().map((f) => join(tmpDir, f));
  const frameMs = String(Math.round(1000 / fps));
  run('img2webp', ['-loop', '0', '-lossy', '-q', String(quality), '-m', '4', '-d', frameMs, ...frames, '-o', webp]);
  rmSync(tmpDir, { recursive: true, force: true });
  console.log(`  ${webp} (${kb(webp)})`);
}
