/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_GRAPHQL_URL?: string;
  readonly VITE_BFF_URL?: string;
  readonly VITE_IMAGE_HOSTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __FLUID_CONFIG__?: import('./runtime-config').FluidRuntimeConfig;
}
