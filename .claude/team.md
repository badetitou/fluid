# Team — fluid

Last retro: none (setup 2026-11-05, refreshed 2026-11-17)

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
One-file fixes and docs: `practices-guardian` alone.

Research team: not used.

Project agent prompts are in French. General UI work and browser verification stay in the main session.

## Skills

- badetitou-team: `task-prep`, `gitlab-flow`, `review-team`, `team-retro`
- other: `run` / built-in browser preview (`.claude/launch.json`: `dev`, `frontend`, `bff`)

## MCP servers

| Server | Where | Used for |
| --- | --- | --- |
| pharo | `.mcp.json`, http://127.0.0.1:4000 | the Moose/Pharo image behind the demo GraphQL API (`localhost:8080`) |

## GitLab

- Repo: gitlab.com/badetitou/fluid — CLI `glab` (`-R badetitou/fluid`).
- Board: Development (id `11711833`) — no lists or labels yet: status = issue open/closed + MR state.
- Milestones: none.
- Flow: one task → one GitLab issue (English) → one minimal MR. CI: `.gitlab-ci.yml` (frontend typecheck + tests, Pages deploy).
- Subagents may merge (`glab mr merge` is allowlisted); push/MR/merge runs on haiku, not the session model.

## Notes from retros

- 2026-11-17 — refresh from plugin 0.6.0: review team added, `gitlab-flow` replaces `github-flow`+glab, implementer listed (issues 3–10 ran as parallel worktree branches), `glab mr merge` allowlisted.
- 2026-11-05 — setup. 79 sessions since 2026-10-21: Bash 2 227 calls (reads with `sed`/`grep`/`git`, `npx vitest run` ×72, `pnpm -r typecheck` ×60), browser 900+ calls, `image_evaluate` 114. Added `scout`, a settings allowlist, a map and workflow in CLAUDE.md, and a rule against committing `launch.json` port changes (restored 12 times).
