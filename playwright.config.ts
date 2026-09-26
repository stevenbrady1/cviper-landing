import { defineConfig } from '@playwright/test';

// The three widths every rendered-output guard runs at. 375 is the width the
// site's own README warns about: the shorthand padding/margin trap in `.hero`
// pins the text to the viewport edge on phones, and nothing else would notice.
const viewports: Record<string, { width: number; height: number }> = {
  'mobile-375': { width: 375, height: 667 },
  'tablet-768': { width: 768, height: 1024 },
  'desktop-1280': { width: 1280, height: 800 },
};

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: the site is static and the server is local, so a failure is
  // real. A retry that goes green would only hide it.
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // Baselines are generated on the CI runner (see the workflow), so
      // same-platform reruns are near byte-stable. This allowance absorbs
      // antialiasing jitter across runner image updates, not layout change:
      // 1% of a 375x2000 page is far less than any real regression moves.
      maxDiffPixelRatio: 0.01,
    },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  webServer: {
    // The site is plain files. python3 -m http.server is present on every
    // GitHub runner and in this repo's dev environments, and it serves
    // directory indexes (/privacy/ -> /privacy/index.html) exactly the way
    // GitHub Pages does for this layout. --bind keeps it off the network.
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
  },
  projects: Object.entries(viewports).map(([name, viewport]) => ({
    name,
    use: {
      browserName: 'chromium' as const,
      viewport,
      // Pinned so a screenshot is the same number of pixels on every machine.
      deviceScaleFactor: 1,
    },
    // The source guards read files, not pages; running them once is enough.
    testIgnore: name === 'desktop-1280' ? [] : ['**/source-guards.spec.ts'],
  })),
});
