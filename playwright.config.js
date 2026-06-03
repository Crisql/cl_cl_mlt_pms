// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Configuration for PMS UI Migration Testing
 * (mirrors ema-ui-migration: validates Angular → Rails parity)
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Run tests sequentially (1 worker) to avoid race conditions
  workers: 1,

  reporter: [
    ['list'],
    ['html']
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10 * 1000,
    navigationTimeout: 10 * 1000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
