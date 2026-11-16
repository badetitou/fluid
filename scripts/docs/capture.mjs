#!/usr/bin/env node
// Regenerates the README media (docs/media/) from a running fluid app.
// See scripts/docs/README.md. Usage:
//   node scripts/docs/capture.mjs [appUrl] [--record] [--only=screens|video]
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkApp, deleteSavedViews, llmFixtures, pageSetup, retryFlakyApi, trackSavedViews } from './lib.mjs';
import { Cuts, toMp4, toPreview, toWebp } from './media.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MEDIA = join(ROOT, 'docs/media');
const FIXTURES = resolve(process.env.FLUID_FIXTURES ?? join(ROOT, 'scripts/docs/fixtures'));
const TMP = join(ROOT, 'scripts/docs/.tmp');

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith('--')) ?? process.env.FLUID_URL ?? 'http://localhost:4990').replace(/\/$/, '');
const RECORD = args.includes('--record');
const ONLY = args.find((a) => a.startsWith('--only='))?.slice(7);
if (ONLY !== undefined && ONLY !== 'screens' && ONLY !== 'video') {
  console.error(`Unknown --only=${ONLY} (expected screens or video)`);
  process.exit(2);
}
if (RECORD && ONLY !== 'screens') console.log('--record captures the screenshots only: the video is skipped.');
const THEME = process.env.FLUID_THEME ?? 'light';
const PROVIDER = process.env.FLUID_LLM_PROVIDER ?? 'claude-code';
const VIEWPORT = { width: 1440, height: 900 };
const EXPLORE_HEIGHT = 724;

const PROMPTS = {
  profile:
    "A profile card with the character's image, status and species, and a table of the episodes they appear in (name, episode code, air_date)",
  episodes:
    'Key stats, a bar chart of how many characters appear in each episode, and a table of the episodes with their air dates',
};

const fixtures = llmFixtures(FIXTURES, { record: RECORD });
const savedViews = new Set();

async function newContext(browser, { video, ...extra }) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: THEME, ...extra });
  // Generate with Claude through the local Claude Code login (the provider the fixtures come from).
  await context.addInitScript((provider) => {
    if (localStorage.getItem('fluid-llm-settings')) return;
    const state = { provider, model: provider === 'claude-code' ? 'sonnet' : '', apiKey: '', baseUrl: '' };
    localStorage.setItem('fluid-llm-settings', JSON.stringify({ state, version: 0 }));
  }, PROVIDER);
  await context.addInitScript(pageSetup, { cursor: video, chrome: video });
  await retryFlakyApi(context);
  await fixtures.install(context);
  trackSavedViews(context, savedViews);
  return context;
}

/**
 * Page helpers. In the video, the pointer glides to each target before clicking and
 * pauses are real; for screenshots, pauses are short and the pointer jumps.
 */
function actor(page, { video }) {
  let at = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
  const pause = (ms) => page.waitForTimeout(video ? ms : Math.min(ms, 600));
  async function glide(locator) {
    if (!video) return;
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
    await locator.waitFor();
    await glide(locator);
    await locator.click();
  };
  return { page, video, pause, click };
}

const demoButton = (page) => page.getByRole('button', { name: /Explore the Rick and Morty demo/ });
const modalOf = (page) => page.locator('.ant-modal').filter({ hasText: 'Create a view with the assistant' });

async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wait until no skeleton or spinner is left in the page. */
async function loaded(page) {
  await page.waitForFunction(
    () => !document.querySelector('.ant-skeleton, .ant-spin-spinning'),
    null,
    { timeout: 30_000 },
  ).catch(() => {});
}

async function openConcept(a, name) {
  // A collapsed sidebar hides the concept entries: expand it first.
  const expand = a.page.getByRole('button', { name: 'Expand navigation' });
  if (await expand.isVisible()) {
    await a.click(expand);
    await a.pause(500);
  }
  await a.click(a.page.locator(`li[role=menuitem][data-menu-id$="-concept:${name}"]`));
  await a.page.waitForURL(`${BASE}/d/${name}`);
}

async function showList(a, tab, firstRow) {
  await a.click(a.page.getByRole('tab', { name: tab }).first());
  await a.page.getByText(firstRow).first().waitFor({ timeout: 30_000 });
  await loaded(a.page);
}

async function openRow(a, name) {
  await a.click(a.page.getByText(name, { exact: true }).first());
  await a.page.getByText('Character detail', { exact: true }).last().waitFor();
  await loaded(a.page);
  await settle(a.page, 600);
}

/** "+" on the last column → AI → type the prompt → wait for the (replayed) answer. */
async function generate(a, fixture, prompt, { typeDelay, delay }) {
  const { page } = a;
  await a.click(page.getByRole('button', { name: 'New perspective' }).last());
  await a.pause(700);
  await a.click(page.getByRole('button', { name: /the assistant builds it/ }));
  const modal = modalOf(page);
  const box = modal.locator('textarea');
  await box.waitFor();
  await a.pause(500);
  await a.click(box);
  await page.keyboard.type(prompt, { delay: typeDelay });
  await a.pause(500);
  fixtures.use(fixture, { delay: RECORD ? 0 : delay });
  await page.keyboard.press('Enter');
  const save = modal.getByRole('button', { name: /Save view/ });
  await save.and(page.locator(':enabled')).waitFor({ timeout: 600_000 });
  await settle(page, 800);
  await loaded(page);
  return { modal, save };
}

/** Scroll the assistant's live preview so the table under the profile card shows. */
async function scrollPreview(modal, by) {
  await modal.locator('[class*="_canvas_"]').first().evaluate((el, dy) => el.scrollBy({ top: dy, behavior: 'smooth' }), by);
  await modal.page().waitForTimeout(700);
}

async function saveView(a, save) {
  await a.click(save);
  await modalOf(a.page).waitFor({ state: 'hidden' });
  await settle(a.page, 800);
  await loaded(a.page);
}

// ---- screenshots ----------------------------------------------------------

/** The full width, down to the last table row that is entirely in the viewport. */
async function toLastFullRow(page, height = VIEWPORT.height) {
  const bottom = await page.locator('.ant-table-row').evaluateAll((rows, h) => {
    // A row counts when no scrolling ancestor (nor the window) cuts it off.
    const shownTo = (el) => {
      let limit = h;
      for (let n = el.parentElement; n; n = n.parentElement) {
        if (getComputedStyle(n).overflowY !== 'visible') limit = Math.min(limit, n.getBoundingClientRect().bottom);
      }
      return limit;
    };
    const ends = rows.map((r) => r.getBoundingClientRect().bottom).filter((b, i) => b <= shownTo(rows[i]));
    return ends.length ? Math.max(...ends) : h;
  }, height);
  return { x: 0, y: 0, width: VIEWPORT.width, height: Math.min(height, Math.ceil(bottom) + 1) };
}

async function screenshots(browser) {
  const context = await newContext(browser, { video: false, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const a = actor(page, { video: false });
  const shot = async (name, clipOf) => {
    await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2);
    await settle(page, 1000);
    const png = join(MEDIA, `${name}.png`);
    await page.screenshot({ path: png, clip: clipOf ? await clipOf() : undefined });
    toWebp(png);
  };
  const around = (locator, pad = 24) => async () => {
    const b = await locator.boundingBox();
    const x = Math.max(0, b.x - pad);
    const y = Math.max(0, b.y - pad);
    return { x, y, width: Math.min(VIEWPORT.width - x, b.width + 2 * pad), height: Math.min(VIEWPORT.height - y, b.height + 2 * pad) };
  };

  await page.goto(`${BASE}/connect`);
  await demoButton(page).waitFor();
  await shot('connect', around(page.locator('.ant-card').filter({ has: demoButton(page) }).last()));
  await a.click(demoButton(page));
  await page.waitForURL(`${BASE}/`);

  await openConcept(a, 'Character');
  await showList(a, 'Character list', 'Rick Sanchez');
  await openRow(a, 'Rick Sanchez');
  await page.locator('[role=tab][aria-selected=true]').evaluateAll((tabs) =>
    tabs.forEach((t) => t.scrollIntoView({ block: 'nearest', inline: 'center' })));
  await shot('explore', async () => ({ x: 0, y: 0, width: VIEWPORT.width, height: EXPLORE_HEIGHT }));

  const profile = await generate(a, 'character-profile', PROMPTS.profile, { typeDelay: 0, delay: 0 });
  await scrollPreview(profile.modal, 50);
  await shot('assistant');
  await saveView(a, profile.save);
  await a.click(page.getByRole('button', { name: 'Full screen' }).last());
  await loaded(page);
  await shot('profile', () => toLastFullRow(page));
  await a.click(page.getByRole('button', { name: 'Exit full screen' }).last());

  await openConcept(a, 'Episode');
  await showList(a, 'Episode list', 'Pilot');
  const episodes = await generate(a, 'episode-stats', PROMPTS.episodes, { typeDelay: 0, delay: 0 });
  await saveView(a, episodes.save);
  // A taller window for this one, so the stats, the chart and a few table rows all show.
  await page.setViewportSize({ ...VIEWPORT, height: 1180 });
  await shot('dashboard', () => toLastFullRow(page, 1180));
  await page.setViewportSize(VIEWPORT);

  await a.click(page.getByRole('button', { name: /settings/i }).last());
  await a.click(page.getByText('Widgets', { exact: true }).first());
  await shot('plugins');
  await context.close();
}

// ---- video ----------------------------------------------------------------

async function video(browser) {
  rmSync(join(TMP, 'video'), { recursive: true, force: true });
  const context = await newContext(browser, { video: true, recordVideo: { dir: join(TMP, 'video'), size: VIEWPORT } });
  const started = Date.now();
  const now = () => (Date.now() - started) / 1000;
  const cuts = new Cuts();
  const page = await context.newPage();
  const a = actor(page, { video: true });

  // Loading the app, then each wait for data, is cut out of the video.
  cuts.start(0);
  await page.goto(`${BASE}/connect`);
  await demoButton(page).waitFor();
  await settle(page, 300);
  cuts.end(now());
  await a.pause(1200);
  await a.click(demoButton(page));
  cuts.start(now());
  await page.waitForURL(`${BASE}/`);
  await page.locator('li[role=menuitem][data-menu-id$="-concept:Character"]').waitFor();
  await settle(page, 800);
  await loaded(page);
  cuts.end(now());
  await a.pause(1000);

  await openConcept(a, 'Character');
  // The default perspective (a graph) loads; the scenario goes to the list straight away.
  cuts.start(now());
  await page.getByRole('tab', { name: 'Character list' }).first().waitFor();
  await settle(page, 800);
  await loaded(page);
  cuts.end(now());
  await a.click(page.getByRole('tab', { name: 'Character list' }).first());
  cuts.start(now());
  await page.getByText('Rick Sanchez').first().waitFor({ timeout: 30_000 });
  await loaded(page);
  cuts.end(now());
  await a.pause(1000);
  // More room for the list and detail columns side by side.
  await a.click(page.getByRole('button', { name: 'Collapse navigation' }));
  await a.pause(600);
  await a.click(page.getByText('Rick Sanchez', { exact: true }).first());
  cuts.start(now());
  await page.getByText('Character detail', { exact: true }).last().waitFor();
  await loaded(page);
  await settle(page, 300);
  cuts.end(now());
  await a.pause(1200);

  const highlight = now();
  const profile = await generate(a, 'character-profile', PROMPTS.profile, { typeDelay: 30, delay: 2500 });
  await a.pause(2200);
  await scrollPreview(profile.modal, 120);
  await a.pause(1800);
  await saveView(a, profile.save);
  await a.pause(2000);

  // The saved view is reused for other characters, without the LLM.
  for (const name of ['Morty Smith', 'Summer Smith']) {
    await a.click(page.getByText(name, { exact: true }).first());
    await settle(page, 300);
    await loaded(page);
    await a.pause(2200);
  }

  // End on a dashboard: the Episode list, with stats and a bar chart from the assistant.
  await openConcept(a, 'Episode');
  cuts.start(now());
  await page.getByRole('tab', { name: 'Episode list' }).first().waitFor();
  await settle(page, 800);
  await loaded(page);
  cuts.end(now());
  await a.click(page.getByRole('tab', { name: 'Episode list' }).first());
  cuts.start(now());
  await page.getByText('Pilot').first().waitFor({ timeout: 30_000 });
  await loaded(page);
  cuts.end(now());
  await a.pause(800);
  const episodes = await generate(a, 'episode-stats', PROMPTS.episodes, { typeDelay: 12, delay: 1500 });
  await a.pause(1500);
  await saveView(a, episodes.save);
  // Park the pointer over the page title: hovering the table would show a sort tooltip.
  await page.mouse.move(VIEWPORT.width / 2, 110, { steps: 10 });
  await a.pause(4000);

  const webm = await page.video().path();
  await context.close();
  toMp4(webm, join(MEDIA, 'demo.mp4'), cuts);
  toPreview(join(MEDIA, 'demo.mp4'), join(MEDIA, 'demo.webp'), join(TMP, 'frames'), {
    startSec: Math.max(0, cuts.outputTime(highlight) - 0.5),
  });
}

mkdirSync(MEDIA, { recursive: true });
mkdirSync(FIXTURES, { recursive: true });
await checkApp(BASE);
const browser = await chromium.launch();
try {
  console.log(`fluid at ${BASE} (${RECORD ? 'recording' : 'replaying'} LLM fixtures, ${THEME} theme)`);
  if (ONLY !== 'video') {
    await screenshots(browser);
    await deleteSavedViews(BASE, savedViews);
  }
  if (ONLY !== 'screens' && !RECORD) {
    await video(browser);
    await deleteSavedViews(BASE, savedViews);
  }
} finally {
  await deleteSavedViews(BASE, savedViews).catch(() => {});
  await browser.close();
  rmSync(TMP, { recursive: true, force: true });
}
