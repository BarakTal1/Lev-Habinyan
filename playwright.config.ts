import { defineConfig } from "@playwright/test";

// Uses the installed Google Chrome, so no browser download is needed. The dev server must run (or it is started).
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000", channel: "chrome", viewport: { width: 390, height: 844 }, locale: "he-IL" },
  webServer: { command: "npm run dev", url: "http://localhost:3000/sign-in", reuseExistingServer: true, timeout: 120_000 },
});
