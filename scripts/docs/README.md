# README media

`capture.mjs` regenerates the screenshots and the demo video in [`docs/media/`](../../docs/media)
with Playwright, against a running fluid app. Run it again after a UI change.

## Run it

```bash
pnpm install
pnpm --filter @fluid/bff exec prisma generate
pnpm --filter @fluid/frontend build

# Start fluid as one process, with a fresh data dir so no saved view gets in the way
cd apps/bff
FLUID_STATIC_DIR=$PWD/../frontend/dist FLUID_DATA_DIR=$(mktemp -d) PORT=4990 DATABASE_URL= \
  node --import tsx src/index.ts &
cd ../..

node scripts/docs/capture.mjs                  # app URL defaults to http://localhost:4990
node scripts/docs/capture.mjs --only=screens   # or --only=video
```

Requirements: Playwright's Chromium (`npx playwright install chromium` if missing), `ffmpeg`
(H.264), and `cwebp` / `img2webp` from libwebp (`brew install webp`). A run takes about two minutes.
The public Rick and Morty API sometimes answers 413: the script retries those requests.

Point the script only at a throwaway app (fresh `FLUID_DATA_DIR`), not at the server you use day to
day: it saves views during the run (and deletes those, and only those, at the end).

Options: `FLUID_THEME=dark` (default `light`), `FLUID_URL` instead of the positional URL,
`FLUID_LLM_PROVIDER` (provider stored in the browser, default `claude-code`), `FLUID_FIXTURES`
(fixtures directory). The fixtures are plain text and can be edited by hand.

## What it produces

| File | Shows |
| --- | --- |
| `connect.webp` | The connection screen with the demo sources |
| `explore.webp` | Miller columns: the Character list and Rick's detail |
| `assistant.webp` | The assistant modal after generating a profile view (chat + live preview) |
| `profile.webp` | That view saved and rendered in the detail column |
| `dashboard.webp` | A generated Episode dashboard: stats, bar chart, table |
| `plugins.webp` | Settings → Plugins → Widgets (the built-in collections) |
| `demo.mp4` | ~60 s session: connect, explore, generate a profile view, save and reuse it, end on a generated Episode dashboard (1440×900, H.264) |
| `demo.webp` | Animated preview of the video for the README (960 px, 12 fps) |

Screenshots are taken at 1440×900 with a device scale factor of 2, then converted to WebP.
Each run deletes the views it saved, so it can be repeated against the same server.

## LLM fixtures

The assistant does not call an LLM during a capture: `fixtures/*.sse` are the raw Server-Sent
Events responses of `POST /api/llm/generate-view/stream`, recorded from Claude (Sonnet, through the
local Claude Code login), and replayed with `page.route()`. The prompts the script types are the
ones the fixtures were recorded with (`PROMPTS` in `capture.mjs`).

To record them again (after a prompt or ViewSpec change), with `claude` installed and logged in on
the machine running the BFF:

```bash
node scripts/docs/capture.mjs --record --only=screens   # two real generations
```

Check the resulting screenshots before committing the new fixtures.
