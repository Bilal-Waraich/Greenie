/**
 * Playwright configuration for the end-to-end tests (tests/e2e), run against the LOCAL Supabase stack
 * and the Vite dev server on 127.0.0.1:5273 (started automatically if it isn't running).
 *
 * Browser projects: Chromium, Firefox and WebKit (close to Safari) at desktop size, and Chromium at
 * 360 x 740 (the smallest width the brief requires). The actions.json test changes the shared action
 * list, so it runs on its own after all the others.
 */
import { defineConfig, devices } from '@playwright/test'

const CONFIG_TEST = /actions-config\.spec\.js/

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Two workers and generous waits: the local Supabase stack in Docker can be slow on a busy machine.
  workers: 2,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5273',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5273',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: CONFIG_TEST },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: CONFIG_TEST },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: CONFIG_TEST },
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, hasTouch: true },
      testIgnore: CONFIG_TEST,
    },
    {
      name: 'actions-config',
      use: { ...devices['Desktop Chrome'] },
      testMatch: CONFIG_TEST,
      dependencies: ['chromium', 'firefox', 'webkit', 'mobile-360'],
    },
  ],
})
