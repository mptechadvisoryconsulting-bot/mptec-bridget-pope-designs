import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const nextBin = "node_modules/next/dist/bin/next";
const devCommand = `"${process.execPath}" "${nextBin}" dev --hostname 0.0.0.0 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: devCommand,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
