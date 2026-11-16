export interface RuntimeConfigEnv {
  FLUID_DEFAULT_GRAPHQL_URL?: string;
  FLUID_IMAGE_HOSTS?: string;
}

const DEFAULT_GRAPHQL_URL = 'https://rickandmortyapi.com/graphql';

/** Comma-separated host list -> non-empty hosts (whitespace, quotes and backslashes stripped). */
export function parseImageHosts(raw: string | undefined): string[] {
  return (raw ?? '')
    .replace(/["\\\s]/g, '')
    .split(',')
    .filter((h) => h !== '');
}

/**
 * Body of /config.js for same-origin serving (bffUrl is always ""). Values are
 * JSON-encoded, and "<" is escaped so the output can never close a script tag.
 */
export function renderRuntimeConfig(env: RuntimeConfigEnv): string {
  const config = {
    bffUrl: '',
    defaultGraphqlUrl: env.FLUID_DEFAULT_GRAPHQL_URL?.trim() || DEFAULT_GRAPHQL_URL,
    imageHosts: parseImageHosts(env.FLUID_IMAGE_HOSTS),
  };
  const json = JSON.stringify(config, null, 2).replace(/</g, '\\u003c');
  return `window.__FLUID_CONFIG__ = ${json};\n`;
}
