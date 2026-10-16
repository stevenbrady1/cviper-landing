// Screenshot comparison for the two real pages, light and dark, at the three
// project widths. This is the pixel half of the safety net; pages.spec.ts is
// the geometry half and tools/check_privacy_drift.py is the content half.
//
// BASELINES ARE GENERATED ON THE CI RUNNER, NEVER ON A DEV MACHINE. The pages
// use the system font stack, so two machines with different fonts render
// different pixels while both being correct. The workflow writes any missing
// baseline with `--update-snapshots=missing` and commits it back to the
// branch; a full refresh is the workflow_dispatch input. Locally these tests
// are skipped unless RUN_VISUAL=1 — run them to eyeball your own rendering,
// but never commit the PNGs your machine produces.

import { test, expect } from '@playwright/test';

test.skip(
  !process.env.CI && !process.env.RUN_VISUAL,
  'screenshot baselines are runner-generated; set RUN_VISUAL=1 to render locally'
);

const pages = [
  { path: '/', slug: 'home' },
  { path: '/privacy/', slug: 'privacy' },
  { path: '/windows-warning/', slug: 'windows-warning' },
] as const;

const schemes = ['light', 'dark'] as const;

for (const { path, slug } of pages) {
  for (const scheme of schemes) {
    test(`${slug} page, ${scheme} scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      // The logo is the only non-inline resource; wait for it so a screenshot
      // never races the image decode.
      await page.waitForLoadState('load');
      // One throwaway full-page capture first. In Chromium the FIRST full-page
      // capture reflows the code chips (`cviper.db`, `api.openai.com`, ...):
      // each moves a pixel, and a long page grows ~30px (privacy at 1280:
      // 7218 -> 7250 on the runner). The page is steady from then on. Without
      // this, toHaveScreenshot spends its 5s timeout on that first unsettled
      // shot and fails on the slow, long pages (privacy, Visual check #80; and
      // the same flake on #73). The real comparison below is unchanged: the
      // settled page against the committed baseline.
      await page.screenshot({ fullPage: true });
      await expect(page).toHaveScreenshot(`${slug}-${scheme}.png`, { fullPage: true });
    });
  }
}
