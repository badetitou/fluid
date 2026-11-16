#!/usr/bin/env node
// Demo video: investigating a Moose model with fluid + Spec-Fluid.
// Needs a fluid app (default http://localhost:4990), MGServer on :8080 and SFServer on :8081.
//   node scripts/docs/moose-demo.mjs [appUrl] [--record] [--shots]
// --record: the assistant really calls the LLM and the answer is saved as a fixture;
// otherwise the fixture is replayed. --shots: also write a PNG at each step (debug).
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkApp, deleteSavedViews, llmFixtures, pageSetup, trackSavedViews } from './lib.mjs';
import { Cuts, toPreview } from './media.mjs';
import { framesToMp4, startScreencast } from './screencast.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(process.env.FLUID_OUT ?? join(ROOT, 'docs/media'));
const FIXTURES = resolve(process.env.FLUID_FIXTURES ?? join(ROOT, 'scripts/docs/fixtures'));
const TMP = join(OUT, '.tmp-moose');
const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:4990').replace(/\/$/, '');
const RECORD = args.includes('--record');
const SHOTS = args.includes('--shots');
const GRAPHQL = process.env.FLUID_GRAPHQL ?? 'http://localhost:8080/graphql';
const SPEC_FLUID = process.env.FLUID_SPEC_FLUID ?? 'http://localhost:8081/spec-fluid';
const THEME = process.env.FLUID_THEME ?? 'dark';
const VIEWPORT = { width: 1440, height: 900 };
// Device scale factor of the capture: 2 records a 2880×1800 video.
const SCALE = Number(process.env.FLUID_SCALE ?? 2);

const PACKAGE = 'AI-Algorithms-Graph';
const CLASS = 'AIDijkstra';
const PROMPT =
  'A bar chart of the number of methods per class, and a table of the classes of this package with their number of methods, lines of code and cyclomatic complexity, sorted by number of methods';

const fixtures = llmFixtures(FIXTURES, { record: RECORD });
const savedViews = new Set();
let shotN = 0;

async function newContext(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: THEME,
    deviceScaleFactor: SCALE,
  });
  await context.addInitScript(({ graphql, specFluid }) => {
    const put = (k, state) => localStorage.getItem(k) || localStorage.setItem(k, JSON.stringify({ state, version: 0 }));
    put('fluid-connection', { graphqlUrl: graphql });
    put('fluid-llm-settings', { provider: 'claude-code', model: 'sonnet', apiKey: '', baseUrl: '' });
    put('fluid-plugins', {
      disabled: [], installed: [], settings: {
        'spec-fluid': { endpoint: specFluid },
        'fluid-pharo-script': { endpoint: specFluid },
      }, builderColors: {},
    });
  }, { graphql: GRAPHQL, specFluid: SPEC_FLUID });
  await context.addInitScript(pageSetup, { cursor: true, chrome: true });
  await fixtures.install(context);
  trackSavedViews(context, savedViews);
  return context;
}

function actor(page) {
  let at = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  const pause = (ms) => page.waitForTimeout(ms);
  async function glide(locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) return;
    const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (let i = 1, n = 18; i <= n; i += 1) {
      const k = 1 - (1 - i / n) ** 3;
      await page.mouse.move(at.x + (to.x - at.x) * k, at.y + (to.y - at.y) * k);
      await page.waitForTimeout(14);
    }
    at = to;
    await page.waitForTimeout(150);
  }
  const click = async (locator) => {
    await locator.waitFor({ timeout: 30_000 });
    await glide(locator);
    await page.mouse.click(at.x, at.y);
  };
  const hover = async (locator) => { await locator.waitFor(); await glide(locator); };
  const shot = async (name) => {
    if (!SHOTS) return;
    shotN += 1;
    await page.screenshot({ path: join(OUT, `moose-step-${String(shotN).padStart(2, '0')}-${name}.png`) });
  };
  return { page, pause, click, hover, shot };
}

async function loaded(page, ms = 600) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.ant-skeleton, .ant-spin-spinning'), null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

const lastTab = (page, name) => page.getByRole('tab', { name, exact: true }).last();

async function run(browser) {
  const context = await newContext(browser);
  const page = await context.newPage();
  const size = { width: VIEWPORT.width * SCALE, height: VIEWPORT.height * SCALE };
  const cast = await startScreencast(page, join(TMP, 'frames-hq'), size);
  const started = Date.now();
  const now = () => (Date.now() - started) / 1000;
  const cuts = new Cuts();
  const a = actor(page);
  const waitCut = async (fn) => { cuts.start(now()); await fn(); cuts.end(now()); };

  // 1. The model's entity types are fluid concepts.
  await waitCut(async () => {
    await page.goto(`${BASE}/`);
    await page.locator('li[role=menuitem][data-menu-id$="-concept:Package"]').waitFor({ timeout: 60_000 });
    await loaded(page, 1000);
  });
  await a.shot('concepts');
  await a.pause(1800);
  await a.click(page.locator('li[role=menuitem][data-menu-id$="-concept:Package"]'));
  await waitCut(async () => {
    await page.getByText(PACKAGE, { exact: true }).first().waitFor({ timeout: 60_000 });
    await loaded(page);
  });
  await a.pause(1000);
  await a.click(page.getByRole('button', { name: 'Collapse navigation' }));
  await a.pause(600);

  // 2. A package: its detail, a Moose overview pyramid, then the Pharo inspector tabs.
  await a.click(page.getByText(PACKAGE, { exact: true }).first());
  await waitCut(async () => { await lastTab(page, 'Navigation').waitFor({ timeout: 60_000 }); await loaded(page); });
  await a.pause(1500);
  await a.click(lastTab(page, 'Overview pyramid'));
  await waitCut(() => loaded(page));
  await a.shot('pyramid');
  await a.pause(2800);
  await a.click(lastTab(page, 'Navigation'));
  await waitCut(() => loaded(page));
  await a.shot('navigation');
  await a.pause(2500);

  // 3. Ask the assistant for a view of the package's classes, on the GraphQL schema.
  await a.click(page.getByRole('button', { name: 'New perspective' }).last());
  await a.pause(700);
  await a.click(page.getByRole('button', { name: /the assistant builds it/ }));
  const modal = page.locator('.ant-modal').filter({ hasText: 'Create a view with the assistant' });
  const box = modal.locator('textarea');
  await box.waitFor();
  await a.pause(400);
  await a.click(box);
  await page.keyboard.type(PROMPT, { delay: 18 });
  await a.pause(500);
  fixtures.use('moose-package-classes', { delay: RECORD ? 0 : 2500 });
  await page.keyboard.press('Enter');
  const save = modal.getByRole('button', { name: /Save view/ });
  await page.waitForTimeout(2500);
  await waitCut(async () => {
    await save.and(page.locator(':enabled')).waitFor({ timeout: 600_000 });
    await loaded(page, 800);
  });
  await a.shot('assistant');
  await a.pause(3000);
  await a.click(save);
  await modal.waitFor({ state: 'hidden' });
  await waitCut(() => loaded(page));
  await a.shot('saved-view');
  await a.pause(2500);

  // 4. A class from that table: Pharo's Roassal blueprint, then a method from it.
  await a.click(page.locator('.ant-table').getByText(CLASS, { exact: true }).last());
  await waitCut(async () => { await lastTab(page, 'Blueprint').waitFor({ timeout: 60_000 }); await loaded(page); });
  await a.pause(1500);
  await a.click(lastTab(page, 'Blueprint'));
  await waitCut(async () => { await page.locator('[data-fluid-ref]').first().waitFor({ timeout: 60_000 }); await loaded(page); });
  await a.shot('blueprint');
  await a.pause(2500);
  const method = page.locator('[data-fluid-ref][data-fluid-type="Method"]').filter({ has: page.locator('rect') });
  const biggest = await method.evaluateAll((els) => {
    const areas = els.map((el) => { const r = el.getBoundingClientRect(); return r.width * r.height; });
    return areas.indexOf(Math.max(...areas));
  });
  await a.click(method.nth(biggest));
  await waitCut(async () => { await page.getByText('Entity Type: Method').last().waitFor({ timeout: 60_000 }); await loaded(page); });
  await a.pause(1200);
  await a.click(lastTab(page, 'SourceText'));
  await waitCut(() => loaded(page));
  await a.shot('source');
  await a.pause(3500);
  await page.mouse.move(VIEWPORT.width / 2, 40, { steps: 10 });
  await a.pause(1500);

  const endSec = now();
  const frames = await cast.stop();
  await context.close();
  framesToMp4(frames, join(OUT, 'moose-demo.mp4'), { cuts, startedSec: started / 1000, endSec, ...size });
  toPreview(join(OUT, 'moose-demo.mp4'), join(OUT, 'moose-demo.webp'), join(TMP, 'frames'), { speed: 1.5 });
}

mkdirSync(OUT, { recursive: true });
mkdirSync(FIXTURES, { recursive: true });
await checkApp(BASE);
const browser = await chromium.launch();
try {
  await run(browser);
} finally {
  await deleteSavedViews(BASE, savedViews).catch(() => {});
  await browser.close();
  rmSync(TMP, { recursive: true, force: true });
}
