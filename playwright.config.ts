import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Run user workflows sequentially to maintain deterministic DB state
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3099',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'tsx server/src/index.ts',
    port: 3099,
    timeout: 15000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      PORT: '3099',
      AUTO_SEED: 'true',
    },
  },
});
