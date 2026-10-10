import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node src/server.js",
    url: "http://127.0.0.1:3101/api/health",
    reuseExistingServer: false,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        "postgresql://tradedocs:tradedocs@127.0.0.1:55432/tradedocs_test",
      NODE_ENV: "test",
      PORT: "3101",
      TRACKING_MODE: "demo",
    },
    timeout: 30000,
  },
});
