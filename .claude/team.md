# Team — fluid

Last retro: 2026-11-19 (setup 2026-11-05, refreshed 2026-11-17)

## Agents

Core:

| Agent | Model | Does | Doesn't |
| --- | --- | --- | --- |
| scout | haiku | read-only exploration, answers with `path:line` | edit |
| implementer (plugin `badetitou-team:implementer`) | sonnet | one brief → one minimal branch in its own worktree | widen scope |
| practices-guardian | sonnet | measures CLAUDE.md rules, updates `docs/architecture/health-log.md`; quick reviewer of a small diff | refactor |

Specialists:

| Agent | Model | Does | Doesn't |
| --- | --- | --- | --- |
| widget-creator | sonnet | new or changed widget type, end to end (contract, renderer, example, tests) | other plugin kinds |
| plugin-creator | sonnet | plugins of the five kinds (theme, widget, viewBuilder, sourceProvider, pageAction) | unrelated features |

Review team (`review-team` skill), plugin agents as-is: `review-correctness`,
`review-stability`, `review-style` (haiku), `review-tests`, `review-contract`,
`review-verifier`. Checks for `branch_checks.py`: `pnpm -r typecheck` and `pnpm test`.
The workflow must pass each lens's `model` to `agent()` (sonnet, haiku for style): without it the
lenses inherit the session model (Opus), whatever their frontmatter says.
One-file fixes and docs: `practices-guardian` alone.

Research team: not used.

Project agent prompts are in French. General UI work and browser verification stay in the main session.

## Skills

- badetitou-team: `task-prep`, `github-flow`, `review-team`, `team-retro`
- other: `run` / built-in browser preview (`.claude/launch.json`: `dev`, `frontend`, `bff`)

## MCP servers

| Server | Where | Used for |
| --- | --- | --- |
| pharo | `.mcp.json`, http://127.0.0.1:4000 | the Moose/Pharo image behind the demo GraphQL API (`localhost:8080`) |

## GitHub

- Repo: github.com/badetitou/fluid — CLI `gh` (`-R badetitou/fluid`). Issues restart from scratch (the GitLab ones are not migrated).
- Flow: one task → one GitHub issue (English) → one minimal PR.
- CI: `.github/workflows/ci.yml` (typecheck + tests, CLI tarball smoke, ghcr.io images, npm publish on `vX.Y.Z`), `pages.yml` (frontend on GitHub Pages).
- Board: user project **#6 « fluid »** (https://github.com/users/badetitou/projects/6), linked to the repo.
  Project id `PVT_kwHOAF78j84BsKT4`; Status field `PVTSSF_lAHOAF78j84BsKT4zhqZsvQ` —
  Todo `f75ad846`, In Progress `47fc9ee4`, Done `98236657` (no *In Review* column).
  The project adds every new repo issue by itself (`item-add` then fails with "already exists"); set
  the status by URL: `gh project item-edit 6 --owner badetitou --url <issue url> --field Status --value "In Progress"`.
  Merging a PR with `Closes #N` moves the card to Done.
- Stacked PRs: open the child PR against the parent branch; once the parent is merged, merge `main`
  into the child and push before retargeting (GitHub marks it "dirty" when the parent arrived by two merges).
- Epics: #1 authenticated sources through the BFF (OAuth, design in `docs/research/oauth-conception.md`),
  #2 MCP Apps (`docs/research/pistes-innovation-2026-11.md`, appendix A). Sub-issues via the sub-issue API.

## Practical notes

- The npx fluid of the user often runs on :4001: verify on other ports (4101+), single-process
  (`FLUID_STATIC_DIR=$PWD/apps/frontend/dist pnpm --filter @fluid/bff start`) with a scratch `FLUID_DATA_DIR`.
- The built-in browser pane cannot open real popups (the OAuth popup replaces the tab, then closes it):
  replay a sign-in with `curl -c jar … /oauth/start` → stub `/authorize` → `curl -b jar <callback>`, or ask
  the user to try in their own browser. The user may click in the pane while you drive it.
- OAuth by hand: `pnpm --filter @fluid/bff exec tsx src/test-support/run-oauth-stub.ts 4600`
  (issuer :4600, protected GraphQL :4601, `/_expire` and `/_reset`).
- MCP Apps by hand: a mini host (Node: SDK `Client` + `StdioClientTransport` on
  `apps/cli/pkg/dist/fluid.mjs mcp`, a page that iframes `ui://fluid/viewer` with `sandbox="allow-scripts"`
  and answers `ui/initialize`, sends `tool-input`/`tool-result`, forwards `tools/call`). The MCP
  Inspector does not render MCP Apps. `apps/cli/pkg/dist/fluid.mjs` runs `mcp` from the build dir,
  but `fluid` itself needs the installed tarball (PGlite).
- Under heavy machine load, BFF tests time out while starting PGlite (30 s hooks): rerun
  `pnpm --filter @fluid/bff test` alone before suspecting the change.

## Notes from retros

- 2026-11-19 — retro: 18 sessions since 2026-11-05; main loop 3.16 M output for 1.01 G cache read, half of it in
  one session chaining 7 PRs (#3 → #28); workflow review lenses ran on Opus (~5.3 M) despite sonnet
  frontmatter; 7 haiku agents for push + PR (~60 k each). Changed: one session per batch of issues,
  push/PR inline, explicit lens models, implementer reports from the diff (badetitou-team), these notes.

- 2026-11-17 — refresh from plugin 0.6.0: review team added, `gitlab-flow` replaces `github-flow`+glab, implementer listed (issues 3–10 ran as parallel worktree branches), `glab mr merge` allowlisted.
- 2026-11-05 — setup. 79 sessions since 2026-10-21: Bash 2 227 calls (reads with `sed`/`grep`/`git`, `npx vitest run` ×72, `pnpm -r typecheck` ×60), browser 900+ calls, `image_evaluate` 114. Added `scout`, a settings allowlist, a map and workflow in CLAUDE.md, and a rule against committing `launch.json` port changes (restored 12 times).
