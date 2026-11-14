import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const database = resolve('.local', 'room-tests', randomUUID(), 'rooms.sqlite');
const hosted = process.env.SHUOWANG_TEST_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'rooms.spec.ts',
  outputDir: '.local/room-test-results',
  fullyParallel: true,
  workers: 2,
  timeout: 150_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL: hosted || 'http://127.0.0.1:8788/',
    launchOptions: process.env.SHUOWANG_BROWSER ? { executablePath: process.env.SHUOWANG_BROWSER } : {},
  },
  webServer: hosted ? undefined : {
    command: 'npm run start:rooms',
    url: 'http://127.0.0.1:8788/api/rooms/health',
    env: { PORT: '8788', SHUOWANG_ROOM_DB: database },
    timeout: 30_000,
  },
});
