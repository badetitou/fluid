// Runtime configuration for the Fluid frontend.
//
// In Docker this file is REGENERATED at container start from environment
// variables (FLUID_BFF_URL, FLUID_DEFAULT_GRAPHQL_URL,
// FLUID_IMAGE_HOSTS) — see
// apps/frontend/docker/entrypoint.sh. For local `pnpm dev` it points at the
// backend-demo (:4000) and BFF (:4001) running on your machine.
//
// bffUrl: base URL of the Fluid BFF. Use "" (empty) to call the same origin,
//         which lets a reverse proxy forward /api to the BFF.
// defaultGraphqlUrl: URL pre-filled on the connect screen.
// imageHosts: hosts the "image" format may load pictures from ("*.domain" for
//             subdomains). Empty = any https host, still behind a user click.
window.__FLUID_CONFIG__ = {
  bffUrl: 'http://localhost:4001',
  defaultGraphqlUrl: 'http://localhost:4000/graphql',
  imageHosts: ['rickandmortyapi.com'],
};
