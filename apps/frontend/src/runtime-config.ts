// Runtime configuration for the Fluid frontend.
//
// The frontend is shipped as a static bundle, so URLs that depend on the
// deployment (the BFF base and the pre-filled GraphQL source) cannot be baked
// in at build time. Instead they are read at runtime from `window.__FLUID_CONFIG__`,
// which is provided by `/config.js` — a tiny file regenerated from environment
// variables when the Docker container starts (see apps/frontend/docker/).
//
// Resolution order for each value: runtime config (config.js) → Vite build env
// (import.meta.env) → sensible localhost default for `pnpm dev`.

export interface FluidRuntimeConfig {
  /** BFF base URL. Empty string means "same origin" (nginx proxies /api). */
  bffUrl?: string;
  /** GraphQL URL pre-filled on the connect screen. */
  defaultGraphqlUrl?: string;
}

const runtime: FluidRuntimeConfig =
  (typeof window !== 'undefined' && window.__FLUID_CONFIG__) || {};

function pick(runtimeValue: unknown, buildValue: unknown, fallback: string): string {
  if (typeof runtimeValue === 'string') return runtimeValue;
  if (typeof buildValue === 'string') return buildValue;
  return fallback;
}

export const BFF_URL = pick(
  runtime.bffUrl,
  import.meta.env.VITE_BFF_URL,
  'http://localhost:4001',
).replace(/\/$/, '');

export const DEFAULT_GRAPHQL_URL = pick(
  runtime.defaultGraphqlUrl,
  import.meta.env.VITE_DEFAULT_GRAPHQL_URL,
  'http://localhost:4000/graphql',
);
