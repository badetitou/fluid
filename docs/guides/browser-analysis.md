# Analyse a repository in the browser

## Try it

Open `https://fluid.badetitou.fr/analyse/<owner>/<repo>` for any public GitHub repository, for example
[google/gson](https://fluid.badetitou.fr/analyse/google/gson) (Java) or
[badetitou/fluid](https://fluid.badetitou.fr/analyse/badetitou/fluid) (TypeScript).

1. A progress page shows the download (`n / N files`), then the build of the model. Small projects take
   a few seconds, a thousand files about a minute. Nothing leaves your browser.
2. fluid opens on the model's **concepts** (Class, Method, File…). Click one to browse its entities
   and their relations. (The assistant that writes views from a prompt needs a BFF and an LLM, which
   the static site does not have: run fluid yourself for that.)
3. **Code analysis → Dashboard** in the sidebar shows big classes, long and unused methods, dead code,
   technical-debt hotspots, and (from Model 0.7.0) dependency cycles, the most connected entities and
   isolated classes and methods.

Good to know:

- The URL is the whole state: share it. `?ref=<branch|tag|sha>` analyses something other than the
  default branch.
- Reloading rebuilds the model and brings you back to the page you were on.
- It works for public repositories only, in Java, TypeScript/TSX, Python and Pharo; other files are
  ignored. Relations (calls, references) are best effort, from tree-sitter without a compiler.
- Too big (see the limits below)? Run fluid yourself with the [GitHub source](github-source.md).

## How it works

`https://fluid.badetitou.fr/analyse/<owner>/<name>` (optionally `?ref=<branch|tag|sha>`) opens fluid on
the code model of a public GitHub repository, with **no server**: the page lists the repository with
GitHub's tree API, downloads the Java, TypeScript/TSX, Python and Pharo (Tonel) files from
`raw.githubusercontent.com` (the tarball host sends no CORS header for other origins), builds the model with [Model](https://github.com/badetitou/Model) compiled to WebAssembly, in a worker,
and answers fluid's GraphQL requests in memory. Nothing leaves the browser.

```
/analyse/o/r → tree API + raw files (page) → Model WASM (worker) → virtual source model-wasm://o/r → fluid
```

The page then redirects to `/` (the concepts); after a reload, fluid sends you back to `/analyse/o/r`
to rebuild the model. Same as the [GitHub source](github-source.md), but on the user's machine; the
BFF's server-side views (`view-run`) cannot reach an in-page model.

Limits: public repositories, GitHub's anonymous API rate limit (60 listings an hour per IP), 3 000
files / 40 MiB of sources, 1 MiB per file, repositories whose tree listing is truncated, tree-sitter
only (no SCIP).

## The WebAssembly module

It is the `model-wasm` crate of [Model](https://github.com/badetitou/Model) (`crates/model-wasm`: the
tree-sitter extractors, the language enrichers and `model-graphql`'s schema, without the server).
The Pages workflow builds it from the Model release named by `MODEL_VERSION` in `pages.yml` (0.7.0 or later: it carries the analysis fields the code dashboard reads).
To build it yourself, use Model's script (needs the `wasm32-unknown-unknown` target, `wasm-pack` and an LLVM
`clang`, `brew install llvm`) and copy the output next to the frontend; it is git-ignored:

```bash
cd ../Model && scripts/build-wasm.sh              # → crates/model-wasm/pkg
cp crates/model-wasm/pkg/model_wasm{.js,_bg.wasm} ../fluid/apps/frontend/public/model-wasm/
```

fluid loads `model_wasm.js` from `modelWasmUrl` (`window.__FLUID_CONFIG__`, or `VITE_MODEL_WASM_URL`;
default `<base>/model-wasm/model_wasm.js`). Contract of the module (`wasm-bindgen --target web`):

| Export | Meaning |
| --- | --- |
| `default(): Promise<unknown>` | initialises the module |
| `class ModelSession` | `new ModelSession()`; `add_file(path, content)` for every file (paths relative to the repository root); `build()` indexes them; `execute(requestJson): string` runs a GraphQL request `{ query, variables, operationName }` and returns the response JSON (`{ data, errors }`), with the same schema as `model-graphql`; `warnings(): string` |

The worker is `apps/frontend/src/entities/analysis/analysis.worker.ts`.
