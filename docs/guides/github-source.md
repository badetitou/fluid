# GitHub source

The GitHub source turns a public GitHub repository into a fluid source: you type `owner/name`, the
BFF downloads the repository, runs [Model](https://github.com/badetitou/Model)'s `model-graphql`
server on it and proxies its GraphQL API. Each repository gets its own `model-graphql` process,
listening on `127.0.0.1` only.

## In the Docker image

The all-in-one image ([`Dockerfile`](../../Dockerfile)) builds `model-graphql` in a Rust stage and
ships it at `/usr/local/bin/model-graphql`, with the feature on:

```
FLUID_REPOS_ENABLED=true
FLUID_MODEL_GRAPHQL_BIN=/usr/local/bin/model-graphql
```

Downloaded repositories go to `/data/repos` (the `/data` volume). Set `FLUID_REPOS_ENABLED=false`
to turn the feature off. The `fluid-bff` image used by the Helm chart does not ship the binary.

## Locally

`model-graphql` has no prebuilt binary; install it with Cargo (Rust 1.100 or later):

```bash
cargo install model-graphql --version 0.5.0 --locked
```

With `npx @badetitou/fluid`, that is all: the CLI finds `model-graphql` (on `PATH` or in
`~/.cargo/bin`) and turns the GitHub source on; its startup log says `GitHub source: on (<path>)`.
Pass `--model-graphql <path>` for a binary elsewhere, or `--no-github` to turn the source off.

For the BFF in development, enable the feature in `apps/bff/.env`:

```bash
FLUID_REPOS_ENABLED=true
# Only if model-graphql is not on PATH (cargo installs it in ~/.cargo/bin):
# FLUID_MODEL_GRAPHQL_BIN=/path/to/model-graphql
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `FLUID_REPOS_ENABLED` | `false` | Registers the GitHub source routes; off otherwise |
| `FLUID_MODEL_GRAPHQL_BIN` | `model-graphql` (on `PATH`) | Path to the `model-graphql` binary |
| `FLUID_REPOS_DIR` | `<data dir>/repos` | Where repositories are downloaded and extracted |
| `FLUID_REPOS_MAX_RUNNING` | `3` | Running `model-graphql` servers; the least recently used is stopped beyond it |
| `FLUID_REPOS_MAX_BYTES` | 200 MiB | Download size limit per repository |

## Limits

- **Public repositories only**: no GitHub token is used, so private repositories cannot be fetched,
  and GitHub's anonymous rate limits apply.
- **Size**: downloads above `FLUID_REPOS_MAX_BYTES` are refused. Each running server keeps its model
  in memory (Model reports ~200 MiB for vscode's 15.7k TypeScript files), hence
  `FLUID_REPOS_MAX_RUNNING`.
- **tree-sitter only**: `model-graphql` runs with `--no-scip`, so no SCIP indexer (and no build of
  the repository) is needed. Entities are exact; relations (calls, references, imports) are best
  effort, without compiler-grade symbol resolution.
- **Languages**: those Model supports — Java, TypeScript/TSX, Python and Pharo (Tonel). Files in
  other languages are ignored.
