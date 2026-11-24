export const USAGE = `Usage: fluid [options]
       fluid mcp [--url URL]

Commands:
  mcp               run an MCP server over stdio for Claude Desktop, VS Code...
                    it talks to a running fluid (--url, default http://localhost:4001
                    or $FLUID_URL); start fluid first. Logs go to stderr.

Options:
  --port N          port to listen on (default 4001, 0 = pick a free one)
  --host H          address to bind (default 127.0.0.1; the API has no auth)
  --data-dir DIR    where PGlite stores data (default ~/.fluid/data)
  --env-file F      load variables from F (never overrides the shell)
  --url URL         (mcp) base URL of the running fluid
  --no-open         do not open the browser
  --no-github       do not offer the GitHub source (on when model-graphql is found)
  --model-graphql P path of badetitou/Model's model-graphql (default: PATH, ~/.cargo/bin)
  --verbose         log requests and show stack traces
  -h, --help        show this help
  -v, --version     show the version

Environment variables honoured:
  FLUID_DATA_DIR            same as --data-dir
  FLUID_MODEL_GRAPHQL_BIN   same as --model-graphql
  FLUID_REPOS_ENABLED       false = same as --no-github
  DATABASE_URL              use an already migrated Postgres instead of PGlite
  LLM_PROVIDER              openai | ollama | claude-code | mock
  OPENAI_API_KEY            key for the openai provider
  OLLAMA_*                  Ollama settings
  Free tiers (Gemini, Groq, OpenRouter) and local LM Studio/llama.cpp: use the
                            UI's "Quick setup" preset with your own API key
  CLAUDE_CODE_BIN/MODEL/TIMEOUT_MS   claude-code provider settings
  FLUID_DEFAULT_GRAPHQL_URL default GraphQL endpoint
  FLUID_IMAGE_HOSTS         comma-separated allowed image hosts
  BROWSER=none, CI          never open the browser
`;
