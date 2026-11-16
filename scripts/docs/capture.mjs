#!/usr/bin/env node
// Regenerates the README media (docs/media/) from a running fluid app.
// See scripts/docs/README.md. Usage:
//   node scripts/docs/capture.mjs [appUrl] [--record] [--only=screens|video]
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deleteSavedViews, fixtureTitles, llmFixtures, retryFlakyApi, toMp4, toPreview, toWebp,
} from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MEDIA = join(ROOT, 'docs/media');
const FIXTURES = resolve(process.env.FLUID_FIXTURES ?? join(ROOT, 'scripts/docs/fixtures'));
const TMP = join(ROOT, 'scripts/docs/.tmp');

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith('--')) ?? process.env.FLUID_URL ?? 'http://localhost:4990').replace(/\/$/, '');
const RECORD = args.includes('--record');
const ONLY = args.find((a) => a.startsWith('--only='))?.slice(7);
const THEME = process.env.FLUID_THEME ?? 'dark';
const PROVIDER = process.env.FLUID_LLM_PROVIDER ?? 'claude-code';
const VIEWPORT = { width: 1440, height: 900 };

const PROMPTS = {
  profile:
    "A profile card with the character's image, status and species, and a table of the episodes they appear in (name, episode code, air_date)",
  episodes:
    'Key stats, a bar chart of how many characters appear in each episode, and a table of the episodes with their air dates',
};

const fixtures = llmFixtures(FIXTURES, { record: RECORD });

async function newContext(browser, extra) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: THEME, ...extra });
  // Generate with Claude through the local Claude Code login (the provider the fixtures come from).
  await context.addInitScript((provider) => {
    if (localStorage.getItem('fluid-llm-settings')) return;
    const state = { provider, model: provider === 'claude-code' ? 'sonnet' : '', apiKey: '', baseUrl: '' };
    localStorage.setItem('fluid-llm-settings', JSON.stringify({ state, version: 0 }));
  }, PROVIDER);
  await retryFlakyApi(context);
  await fixtures.install(context);
  return context;
}

// ---- scenario steps -------------------------------------------------------

const lastColumnPlus = (page) => page.getByRole('button', { name: 'New perspective' }).last();

async function connectDemo(page, pause) {
  await page.goto(`${BASE}/connect`);
  await page.getByRole('button', { name: /Explore the Rick and Morty demo/ }).waitFor();
  await pause(1500);
  await page.getByRole('button', { name: /Explore the Rick and Morty demo/ }).click();
  await page.waitForURL(`${BASE}/`);
}

async function openConcept(page, name, pause) {
  await page.locator(`li[role=menuitem][data-menu-id$="-concept:${name}"]`).click();
  await page.waitForURL(`${BASE}/d/${name}`);
  await pause(1200);
}

async function showList(page, tab, firstRow, pause) {
  await page.getByText(tab, { exact: true }).click();
  await page.getByText(firstRow).first().waitFor({ timeout: 30_000 });
  await pause(1200);
}

async function openRow(page, name, pause) {
  await page.getByText(name, { exact: true }).first().click();
  await page.getByText('Character detail', { exact: true }).last().waitFor();
  await pause(1500);
}

/** "+" on the last column → AI → type the prompt → wait for the (replayed) answer. */
async function generate(page, fixture, prompt, { typeDelay, pause }) {
  await lastColumnPlus(page).click();
  await pause(800);
  await page.getByRole('button', { name: /the assistant builds it/ }).click();
  const modal = page.locator('.ant-modal').filter({ hasText: 'Create a view with the assistant' });
  const box = modal.locator('textarea');
  await box.waitFor();
  await pause(800);
  await box.click();
  await page.keyboard.type(prompt, { delay: typeDelay });
  await pause(600);
  fixtures.use(fixture);
  await page.keyboard.press('Enter');
  const save = modal.getByRole('button', { name: /Save view/ });
  await save.and(page.locator(':enabled')).waitFor({ timeout: 600_000 });
  await settle(page);
  await loadImages(modal);
  return { modal, save };
}

/**
 * fluid never fetches an image without a click: load the first one, trusting its
 * host for the session so the next ones load by themselves.
 */
async function loadImages(scope) {
  const page = scope.page ? scope.page() : scope;
  const button = scope.getByRole('button', { name: /Load image/ }).first();
  if (!(await button.isVisible().catch(() => false))) return;
  await button.click();
  const trust = page.getByRole('checkbox', { name: /Trust .* for this session/ });
  await trust.check().catch(() => {});
  await page.getByRole('button', { name: 'Load', exact: true }).click().catch(() => {});
  await page.waitForTimeout(800);
}

/** Park the pointer where it shows no hover state. */
const parkMouse = (page) => page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2);

async function settle(page, ms = 2500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function saveView(page, save, pause) {
  await save.click();
  await page.locator('.ant-modal').filter({ hasText: 'Create a view with the assistant' }).waitFor({ state: 'hidden' });
  await settle(page, 1500);
  await loadImages(page);
  await pause(1500);
}

// ---- runs -----------------------------------------------------------------

async function screenshots(browser) {
  const context = await newContext(browser, { deviceScaleFactor: 2 });
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(Math.min(ms, 800));
  const shot = async (name) => {
    await parkMouse(page);
    await settle(page, 1200);
    const png = join(MEDIA, `${name}.png`);
    await page.screenshot({ path: png });
    toWebp(png);
  };

  await page.goto(`${BASE}/connect`);
  await page.getByRole('button', { name: /Explore the Rick and Morty demo/ }).waitFor();
  await shot('connect');
  await page.getByRole('button', { name: /Explore the Rick and Morty demo/ }).click();
  await page.waitForURL(`${BASE}/`);

  await openConcept(page, 'Character', pause);
  await showList(page, 'Character list', 'Rick Sanchez', pause);
  await openRow(page, 'Rick Sanchez', pause);
  await shot('explore');

  const profile = await generate(page, 'character-profile', PROMPTS.profile, { typeDelay: 0, pause });
  await shot('assistant');
  await saveView(page, profile.save, pause);
  await shot('profile');

  await openConcept(page, 'Episode', pause);
  await showList(page, 'Episode list', 'Pilot', pause);
  const episodes = await generate(page, 'episode-stats', PROMPTS.episodes, { typeDelay: 0, pause });
  await saveView(page, episodes.save, pause);
  await shot('dashboard');

  await page.getByRole('button', { name: /settings/i }).last().click();
  await page.getByText('Widgets', { exact: true }).first().click();
  await shot('plugins');
  await context.close();
}

async function video(browser) {
  rmSync(join(TMP, 'video'), { recursive: true, force: true });
  const context = await newContext(browser, { recordVideo: { dir: join(TMP, 'video'), size: VIEWPORT } });
  const started = Date.now();
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);

  await page.goto(`${BASE}/connect`);
  await page.getByRole('button', { name: /Explore the Rick and Morty demo/ }).waitFor();
  await settle(page, 300);
  const trim = (Date.now() - started) / 1000;
  await connectDemo(page, pause);
  await pause(1500);
  await openConcept(page, 'Character', pause);
  await showList(page, 'Character list', 'Rick Sanchez', pause);
  await openRow(page, 'Rick Sanchez', pause);

  const { save } = await generate(page, 'character-profile', PROMPTS.profile, { typeDelay: 35, pause });
  await pause(4000);
  await saveView(page, save, pause);
  await pause(2500);

  // The saved view is reused for another character, without the LLM.
  await page.getByText('Morty Smith', { exact: true }).first().click();
  await settle(page, 1500);
  await loadImages(page);
  await pause(3500);
  await page.getByText('Summer Smith', { exact: true }).first().click();
  await settle(page, 1500);
  await loadImages(page);
  await pause(3000);

  await openConcept(page, 'Episode', pause);
  await settle(page, 1000);
  await pause(3000);
  await openConcept(page, 'Location', pause);
  await settle(page, 1000);
  await pause(3000);

  const webm = await page.video().path();
  await context.close();
  toMp4(webm, join(MEDIA, 'demo.mp4'), trim);
  toPreview(join(MEDIA, 'demo.mp4'), join(MEDIA, 'demo.webp'), join(TMP, 'frames'));
}

mkdirSync(MEDIA, { recursive: true });
mkdirSync(FIXTURES, { recursive: true });
const browser = await chromium.launch();
try {
  console.log(`fluid at ${BASE} (${RECORD ? 'recording' : 'replaying'} LLM fixtures, ${THEME} theme)`);
  if (ONLY !== 'video') {
    await deleteSavedViews(BASE, fixtureTitles(FIXTURES));
    await screenshots(browser);
  }
  if (ONLY !== 'screens' && !RECORD) {
    await deleteSavedViews(BASE, fixtureTitles(FIXTURES));
    await video(browser);
  }
  await deleteSavedViews(BASE, fixtureTitles(FIXTURES));
} finally {
  await browser.close();
  rmSync(TMP, { recursive: true, force: true });
}
