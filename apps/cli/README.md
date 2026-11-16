# @badetitou/fluid

Explore and shape any GraphQL API through reusable, LLM-generated dashboard views.

```bash
npx @badetitou/fluid
```

Requires Node.js 22 or later. fluid starts on http://localhost:4001, stores its data with embedded
PGlite in `~/.fluid/data` and opens your browser. It has no GraphQL backend of its own: connect it
to a public API (Rick and Morty by default) or to any GraphQL endpoint.

## Options

```
--port N          port (default 4001, 0 = any free port)
--host H          bind address (default 127.0.0.1)
--data-dir DIR    PGlite data directory (default ~/.fluid/data)
--env-file F      load variables from F (never overrides the shell)
--no-open         do not open the browser
--verbose         request logs and stack traces
-h, --help        usage
-v, --version     version
```

Only one fluid can use a data directory at a time; a second one exits with a message naming the
owner. A `.env` file in the current directory is never read: use `--env-file`.

## Environment variables

`FLUID_DATA_DIR`, `DATABASE_URL`, `LLM_PROVIDER` (`openai`, `ollama`, `claude-code`, `mock`),
`OPENAI_API_KEY`, `OLLAMA_*`, `CLAUDE_CODE_BIN`, `CLAUDE_CODE_MODEL`, `CLAUDE_CODE_TIMEOUT_MS`,
`FLUID_DEFAULT_GRAPHQL_URL`, `FLUID_IMAGE_HOSTS`. `PORT` is not read: use `--port`.

- **claude-code provider**: needs the `claude` CLI on your `PATH` (logged in), or `CLAUDE_CODE_BIN`.
- **Postgres**: with `DATABASE_URL` set, fluid uses that database instead of PGlite. It must already
  be migrated (`prisma migrate deploy`); fluid does not apply migrations there.

## Security

The API has no authentication and proxies your LLM credentials and local `claude` CLI. It listens
on `127.0.0.1` by default. Use `--host 0.0.0.0` only on networks you trust.

## Platforms

macOS and Linux are tested. Windows is untested.

Source: https://gitlab.com/badetitou/fluid (MIT).
