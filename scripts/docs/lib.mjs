// Helpers for capture.mjs: LLM fixtures (record / replay), flaky-API retries,
// cleanup of the views a run saved, and the capture-only page setup.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const GENERATE_ROUTE = '**/api/llm/generate-view/stream';
const RICK_AND_MORTY = 'https://rickandmortyapi.com/graphql';

/**
 * Serve the assistant from recorded fixtures (replay) or record them from the
 * real provider (record). `use(name)` names the fixture the next generation
 * reads or writes, so the scenario stays explicit about which answer it gets.
 */
export function llmFixtures(fixturesDir, { record }) {
  let next = null;
  let delayMs = 3500;
  const file = (name) => join(fixturesDir, `${name}.sse`);

  async function install(context) {
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
    use: (name, { delay = 3500 } = {}) => {
      if (!record && !existsSync(file(name))) {
        throw new Error(`Missing fixture ${file(name)}: run with --record first`);
      }
      next = name;
      delayMs = delay;
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

/**
 * Remember the views this run saves (POST /api/views), so `deleteSavedViews` removes
 * those and nothing else: the user's own views survive even against a real data dir.
 */
export function trackSavedViews(context, ids) {
  context.on('response', async (res) => {
    if (res.request().method() !== 'POST' || !/\/api\/views$/.test(new URL(res.url()).pathname)) return;
    if (!res.ok()) return;
    const view = await res.json().catch(() => null);
    if (view?.id) ids.add(view.id);
  });
}

export async function deleteSavedViews(baseUrl, ids) {
  for (const id of ids) {
    await fetch(`${baseUrl}/api/views/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  ids.clear();
}

/** Fail early when nothing answers at `baseUrl`. */
export async function checkApp(baseUrl) {
  const res = await fetch(`${baseUrl}/health`).catch(() => null);
  if (!res?.ok) throw new Error(`No fluid app at ${baseUrl} (GET /health failed)`);
}

/**
 * In-page setup for every capture page: trust the Rick and Morty image host (fluid asks
 * before loading any image), hide the floating column actions that cover content and,
 * when `chrome` is false, the column pager. With `cursor`, draw the pointer, which
 * Playwright videos leave out, with a ripple on each click.
 */
export function pageSetup({ cursor, chrome }) {
  try {
    sessionStorage.setItem('fluid-trusted-image-hosts', JSON.stringify(['rickandmortyapi.com']));
  } catch {
    // no storage: the capture clicks "Load image" instead
  }
  const css = [
    '.ant-float-btn-group, .ant-float-btn { display: none !important; }',
    chrome ? '' : 'div:has(> button[aria-label="Previous column"]), .ant-message { display: none !important; }',
    '#capture-cursor { position: fixed; z-index: 2147483647; pointer-events: none; width: 22px; height: 22px;',
    '  margin: -11px 0 0 -11px; border-radius: 50%; left: -50px; top: -50px;',
    '  background: rgba(22, 119, 255, 0.28); border: 2px solid rgba(22, 119, 255, 0.9); }',
    '.capture-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 22px; height: 22px;',
    '  margin: -11px 0 0 -11px; border-radius: 50%; border: 3px solid rgba(22, 119, 255, 0.8);',
    '  animation: capture-ripple 450ms ease-out forwards; }',
    '@keyframes capture-ripple { to { transform: scale(2.6); opacity: 0; } }',
  ].join('\n');
  const install = () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    if (!cursor) return;
    const dot = document.createElement('div');
    dot.id = 'capture-cursor';
    document.documentElement.appendChild(dot);
    addEventListener('mousemove', (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    }, true);
    addEventListener('mousedown', (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'capture-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.documentElement.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
}
