import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: process.env.SHUOWANG_BROWSER ? { executablePath: process.env.SHUOWANG_BROWSER } : {},
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    env: { VITE_FEEDBACK_FORM_ID: 'playwrightdemo' },
    reuseExistingServer: !process.env.CI,
  },
});
