import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Never let a test open (or lock) the user's ~/.fluid/data.
    env: { FLUID_DATA_DIR: 'memory://' },
    // Some tests open a real PGlite database on disk, which is slow on shared CI runners.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
