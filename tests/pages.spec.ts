// Rendered-output guards for the pages people actually visit.
//
// These assert what a visitor's browser shows, not what the source contains
// (the hosted repo's LESSON-034: content guards scan rendered output). The
// classes guarded here are the ones this project has actually been bitten by:
// text pinned to the viewport edge on phones (this repo's README documents the
// `.hero` shorthand trap), pages that scroll sideways at phone width, and a
// download button that stops pointing at the newest release.

import { test, expect, type Page } from '@playwright/test';

const REPO = 'https://github.com/stevenbrady1/cviper-light';
const RELEASES_LATEST = `${REPO}/releases/latest`;

async function expectNoSidewaysScroll(page: Page) {
  const doc = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // +1 forgives sub-pixel rounding, nothing more; a real overflow is tens of
  // pixels wide.
  expect(doc.scrollWidth, 'the page must not scroll sideways').toBeLessThanOrEqual(doc.clientWidth + 1);
}

// The .wrap container gives every page a 20px side gutter. If a future edit
// re-triggers the shorthand padding/margin trap the README documents, the
// heading lands at x=0 — so "the heading starts at least 16px in" is the
// rendered form of that rule.
async function expectLeftGutter(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} must render`).not.toBeNull();
  expect(box!.x, `${selector} must keep the side gutter`).toBeGreaterThanOrEqual(16);
}

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the hero inside its gutter, with no sideways scroll', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make every application count.');
    await expectLeftGutter(page, 'h1');
    await expectNoSidewaysScroll(page);
  });

  test('the primary button downloads the latest published release', async ({ page }) => {
    const cta = page.getByRole('link', { name: /download cviper light for windows/i });
    await expect(cta).toBeVisible();
    // /releases/latest resolves to the newest published, non-draft release,
    // so the page never carries a version number that can go stale.
    await expect(cta).toHaveAttribute('href', RELEASES_LATEST);
    const box = await cta.boundingBox();
    expect(box!.height, 'the download button must stay a comfortable tap target').toBeGreaterThanOrEqual(44);
  });

  test('privacy is reachable without JavaScript: real links in nav and footer', async ({ page }) => {
    await expect(page.locator('nav a[href="/privacy/"]')).toHaveCount(1);
    await expect(page.locator('footer a[href="/privacy/"]')).toHaveCount(1);
  });

  test('the old app link ?tab=privacy forwards to the policy', async ({ page }) => {
    // CViper Light builds shipped CVIPER_PRIVACY_URL = 'https://cviper.ai/?tab=privacy'.
    await page.goto('/?tab=privacy');
    await page.waitForURL('**/privacy/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  });
});

test.describe('privacy page', () => {
  test('renders inside its gutter, with no sideways scroll', async ({ page }) => {
    await page.goto('/privacy/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
    await expectLeftGutter(page, 'h1');
    await expectNoSidewaysScroll(page);
  });
});

test.describe('published URLs that must keep working', () => {
  // The app's About screen and both store-listing documents publish these
  // exact URLs; each file's own comment says why it must not 404.
  test('/light/ forwards to the home page', async ({ page }) => {
    await page.goto('/light/');
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make every application count.');
  });

  test('/light/privacy/ forwards to the policy', async ({ page }) => {
    await page.goto('/light/privacy/');
    await page.waitForURL('**/privacy/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  });
});
