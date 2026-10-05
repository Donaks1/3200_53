import { defineConfig, devices } from '@playwright/test'

// Every end-to-end test runs twice: as an iPhone and as an Android phone.
// We test the built app because the offline part (service worker) only exists in the build.
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
})
