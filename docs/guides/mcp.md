# Using fluid from an AI assistant (MCP)

`fluid mcp` is an [MCP](https://modelcontextprotocol.io) server. It lets an AI assistant (Claude Code,
Claude Desktop, VS Code…) list your data sources and saved views, run a view and read its result,
and **write a new view** that fluid checks, runs and can keep. Hosts that support
[MCP Apps](https://modelcontextprotocol.io/extensions/apps) also show the view itself, live, in the
conversation.

This guide sets it up with **Claude Code** on the Rick and Morty API, then walks through a session.
Design notes for contributors are in [`docs/architecture/MCP.md`](../architecture/MCP.md).

## How it fits together

```mermaid
flowchart LR
    H[AI host<br/>Claude Code, Claude Desktop…] -- stdio --> M[fluid mcp]
    M -- HTTP --> F[fluid<br/>npx @badetitou/fluid]
    F -- GraphQL --> S[(Your source<br/>e.g. Rick and Morty)]
```

- `fluid mcp` is a thin client: it never opens fluid's data directory. **fluid must be running**
  (default `http://localhost:4001`; `--url` or `FLUID_URL` for another address).
- The assistant only reaches the sources **configured in fluid's BFF** (Settings → Connection →
  **Via the BFF**). A source you only browse directly from the browser is not visible to it.
- Queries are read-only. Mutations (view actions) run only from the viewer, after you confirm, on a
  source where **Allow changes** is on. The model itself can never run one.

## Tools

| Tool | Seen by | What it does |
| --- | --- | --- |
| `list_sources` | model | Sources configured in fluid (id, name, url, auth, OAuth signed-in state) |
| `list_views` | model, viewer | Saved views (id, title, concept), optionally for one concept |
| `show_view` | model, viewer | Runs a saved view on a source; the model gets a summary, the viewer the data |
| `get_source_schema` | model | The source's GraphQL SDL, to write valid queries |
| `draft_view` | model, viewer | Checks a view draft like fluid's own assistant, runs it, returns the result or the issues to fix |
| `save_view` | viewer | Keeps a draft in fluid (the viewer's **Save in fluid** button) |
| `run_queries` | viewer | Reloads a view's data (more rows, other variables) |
| `invoke_action` | viewer | Runs a view action (mutation) once you confirmed it |

"Seen by" is the MCP Apps `visibility` of each tool: hosts that support MCP Apps hide the viewer-only
tools from the model.

## Try it with Claude Code

### 1. Start fluid

```bash
npx @badetitou/fluid@latest
```

`fluid mcp` needs version 0.2.0 or later. To try unreleased changes, build the package from a clone
and use the tarball instead of `@badetitou/fluid@latest` everywhere in this guide:

```bash
pnpm install && pnpm pack:cli          # writes out/badetitou-fluid-0.1.0.tgz
npx -y --package "$PWD/out/badetitou-fluid-0.1.0.tgz" fluid
```

### 2. Register the source in the BFF

In fluid, pick **Explore the Rick and Morty demo**, then open **Settings → Connection** and turn on
**Via the BFF**. The source is now stored by fluid and offered to the assistant.

Without the UI, the same thing with one request:

```bash
curl -s -X POST http://localhost:4001/api/sources -H 'content-type: application/json' \
  -d '{"name":"Rick and Morty","url":"https://rickandmortyapi.com/graphql"}'
```

### 3. Add the MCP server to Claude Code

```bash
claude mcp add fluid -- npx -y @badetitou/fluid@latest mcp
```

From a local build, point at the tarball:

```bash
claude mcp add fluid -- npx -y --package "$PWD/out/badetitou-fluid-0.1.0.tgz" fluid mcp
```

Add `--scope project` to write it to the project's `.mcp.json` instead of your user settings, and
`--url http://host:port` after `mcp` if fluid is not on port 4001. Start `claude` and check that
`/mcp` lists **fluid** as connected.

### 4. A session

Ask in plain words; Claude chains the tools:

> **You:** Which data sources does fluid have?
>
> *Claude calls `list_sources`* → `Rick and Morty` (`https://rickandmortyapi.com/graphql`)
>
> **You:** Build me an overview of the episodes: how many there are and a table with their code,
> name and air date.
>
> *Claude calls `get_source_schema`, writes a draft, then calls `draft_view`.*

A draft like the one Claude sends:

```json
{
  "sourceId": "<id from list_sources>",
  "concept": "Episode",
  "request": "Overview of the episodes: count and a table with code, name and air date",
  "view": {
    "title": "Episodes",
    "queries": {
      "eps": { "query": "query { episodes { results { id name air_date episode } } }" }
    },
    "widgets": [
      {
        "id": "count", "type": "statistic", "title": "Episodes (first page)",
        "data": { "query": "eps", "path": "episodes.results" },
        "value": { "op": "count" }
      },
      {
        "id": "list", "type": "table", "title": "Episodes",
        "data": { "query": "eps", "path": "episodes.results" },
        "columns": [
          { "key": "episode", "title": "Code" },
          { "key": "name", "title": "Name" },
          { "key": "air_date", "title": "Aired" }
        ]
      }
    ]
  }
}
```

fluid validates it (widget shapes, wiring, every query against the schema), runs it and answers:

```text
View "Episodes": 2 widgets (statistic, table).
Queries:
- eps: 20 rows
Shown in the viewer: the user can keep it with "Save in fluid".
```

A draft with mistakes comes back as a tool error listing them, and Claude fixes it and retries, e.g.:

```text
fluid refused it:
- widgets.1.columns.0.key: Invalid input: expected string, received undefined
```

Then, once a view is saved:

> **You:** Show the Episodes view with 5 rows.
>
> *Claude calls `list_views`, then `show_view` with `take: 5`.*

### What Claude Code shows

Claude Code runs in a terminal: it does not draw the MCP Apps viewer, so you work with the text
summaries above, and the viewer-only tools (Save in fluid, actions, loading more rows) depend on how
the host handles their `visibility`. To keep a view, open fluid at `http://localhost:4001` and build
it there from the same request, or use a host that shows the viewer (Claude Desktop, or the
`basic-host` of [ext-apps](https://github.com/modelcontextprotocol/ext-apps)), where the draft is
rendered live with a **Save in fluid** button.

## Other hosts

The server is the same; only the configuration file changes.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{ "mcpServers": { "fluid": { "command": "npx", "args": ["-y", "@badetitou/fluid@latest", "mcp"] } } }
```

**VS Code** (`.vscode/mcp.json`, `servers` instead of `mcpServers`):

```json
{ "servers": { "fluid": { "command": "npx", "args": ["-y", "@badetitou/fluid@latest", "mcp"] } } }
```

**MCP Inspector**, to call the tools by hand:

```bash
npx @modelcontextprotocol/inspector npx -y @badetitou/fluid@latest mcp
```

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Tools answer that fluid is unreachable | fluid is not running, or not at the URL given to `fluid mcp` (`--url`, `FLUID_URL`) |
| `list_sources` is empty | No source is routed through the BFF: turn on **Via the BFF** (step 2) |
| A tool asks you to sign in | The source uses OAuth: sign in from Settings → Connection in fluid, then retry |
| "results over 256 KB are refused" | Lower `take` in the request ("show it with 20 rows") |
| `fluid mcp: viewer not found … serving the placeholder` on stderr | Running from sources without `pnpm pack:cli`; the tools work, only the viewer is a placeholder |
