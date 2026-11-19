import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Never let a test open (or lock) the user's ~/.fluid/data.
    env: { FLUID_DATA_DIR: 'memory://' },
    // Some tests open a real PGlite database, which takes seconds to start on shared CI runners and
    // loaded machines. Few files at once keeps PGlite start-up times bounded; hooks get extra time.
    maxWorkers: 4,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
