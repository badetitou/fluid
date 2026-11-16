import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Never let a test open (or lock) the user's ~/.fluid/data.
  test: { env: { FLUID_DATA_DIR: 'memory://' } },
});
