import { defineConfig } from 'vitest/config';

// Unit tests only. src/tests/calibration.test.ts is the in-app Admin calibration, not a vitest file,
// and tests/*.check.ts are tsx scripts.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
