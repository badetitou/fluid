# Team — fluid

Last retro: none (setup 2026-11-05)

## Agents

| Agent | Model | Does | Doesn't |
| --- | --- | --- | --- |
| scout | haiku | read-only exploration, answers with `path:line` | edit |
| widget-creator | sonnet | new or changed widget type, end to end (contract, renderer, example, tests) | other plugin kinds |
| plugin-creator | sonnet | plugins of the five kinds (theme, widget, viewBuilder, sourceProvider, pageAction) | unrelated features |
| practices-guardian | sonnet | measures CLAUDE.md rules, updates `docs/architecture/health-log.md`; acts as reviewer before an MR | refactor |

Agent prompts are in French. General UI work and browser verification stay in the main session.

## Skills

- badetitou-team: `task-prep`, `team-retro` (`github-flow` conventions apply, but with `glab` instead of `gh`)
- other: `run` / built-in browser preview (`.claude/launch.json`: `dev`, `frontend`, `bff`)

## MCP servers

| Server | Where | Used for |
| --- | --- | --- |
| pharo | `.mcp.json`, http://127.0.0.1:4000 | the Moose/Pharo image behind the demo GraphQL API (`localhost:8080`) |

## GitLab

- Repo: gitlab.com/badetitou/fluid — CLI `glab` (`-R badetitou/fluid`). No labels yet.
- Flow: one task → one GitLab issue (English) → one minimal MR. CI: `.gitlab-ci.yml` (frontend typecheck + tests, Pages deploy).
- No GitHub Project: status lives on the GitLab issue/MR.

## Notes from retros

- 2026-11-05 — setup. 79 sessions since 2026-10-21: Bash 2 227 calls (reads with `sed`/`grep`/`git`, `npx vitest run` ×72, `pnpm -r typecheck` ×60), browser 900+ calls, `image_evaluate` 114. Added `scout`, a settings allowlist, a map and workflow in CLAUDE.md, and a rule against committing `launch.json` port changes (restored 12 times).
