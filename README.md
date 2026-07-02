# fluid

> Explore and shape your data the way Smalltalk inspectors let you explore objects — but for the web.

**fluid** is an experiment in *interface-less* web apps. Instead of shipping pre-built screens, fluid
connects to a GraphQL data source, introspects it, and lets users **explore the concepts** (types) of the
backend themselves. Clicking a concept opens a dashboard **view**:

- If one or more views already exist for that concept, fluid renders them — with a selector to switch
  between them, just like the tabs of a Smalltalk inspector. A `+view` button lets you create new ones.
- If no view exists (or you press `+`), an **LLM chat** appears. It is pre-prompted with the concept's
  schema and related concepts, and you simply describe what you'd like to see. The LLM returns a
  **declarative view specification** (tables, charts, stats — dashboard-like, little prose).
- Views you like can be **persisted** and reused later **without the LLM**: the saved view simply takes
  the concept (and instance) as a parameter.

Views use a **hybrid model**: parameterizable widgets + a declarative layout (JSON), rendered by an
extensible widget catalog built on [Ant Design](https://ant.design/) and
[@ant-design/plots](https://charts.ant.design/).

## Monorepo layout

| Package | Stack | Role |
| --- | --- | --- |
| `apps/frontend` (`@fluid/frontend`) | React + Vite + TypeScript, Ant Design, @ant-design/plots, urql, react-router | Connect to GraphQL → explore concepts → render views → LLM view-builder chat |
| `apps/bff` (`@fluid/bff`) | Node + TypeScript, Prisma | LLM proxy (OpenAI + Ollama), view persistence, preferences |
| `apps/backend-demo` (`@fluid/backend-demo`) | GraphQL Yoga + Pothos + Prisma | Demo **bank** GraphQL API (Customer, Account, Transaction, Card, Beneficiary, Transfer) seeded with faker |

Shared types (view spec, zod schemas) live in `packages/shared`.

## Requirements

- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- Docker (e.g. via [Colima](https://github.com/abiosoft/colima) on macOS) for local PostgreSQL

## Getting started

```bash
# 1. install dependencies
pnpm install

# 2. start PostgreSQL (shared by backend-demo and bff)
docker compose up -d

# 3. set up the demo bank database
pnpm --filter @fluid/backend-demo prisma:migrate
pnpm --filter @fluid/backend-demo seed

# 4. run everything in dev mode
pnpm dev
```

The demo GraphQL API defaults to <http://localhost:4000/graphql> (GraphiQL enabled). The frontend
pre-fills this URL on its connection screen.

## Deployment

A single parameterizable **Helm chart** deploys the frontend, BFF, backend-demo, and PostgreSQL, with
example values for local clusters (kind/minikube) and cloud. Images are built and pushed to GHCR by
GitHub Actions. *(Added in a later phase.)*

## Status

Early work in progress. Build order:

1. ✅/🚧 Monorepo scaffold + demo bank backend + concept introspection & explorer
2. Declarative view engine + widget catalog
3. Multi-view selector + persistence (BFF)
4. LLM view generation (OpenAI + Ollama)
5. Dockerfiles + Helm chart + CI (GHCR)

## License

[MIT](./LICENSE)
