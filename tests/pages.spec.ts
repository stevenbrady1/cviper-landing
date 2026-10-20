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
// The one installer name the cviper-light Release workflow puts on every
// release (its `stable-download` job, held by stable-download-name.contract.test.ts
// over there). /releases/latest/download/<name> serves that file from the
// newest published release, so the button downloads in one click and still
// never carries a version number (L-245).
const STABLE_INSTALLER = 'CViper-Light-Windows-x64.exe';
const DOWNLOAD_LATEST = `${RELEASES_LATEST}/download/${STABLE_INSTALLER}`;
// The Mac disk image's stable name, written by the same job (L-261).
const STABLE_MAC_IMAGE = 'CViper-Light-macOS.dmg';
const DOWNLOAD_MAC_LATEST = `${RELEASES_LATEST}/download/${STABLE_MAC_IMAGE}`;

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

  test('the primary button downloads the installer itself, from the latest published release', async ({ page }) => {
    const cta = page.getByRole('link', { name: /download cviper light for windows/i });
    await expect(cta).toBeVisible();
    // Not the release PAGE: that left visitors to pick one file out of seven
    // (L-245). The installer, by the name that never changes.
    await expect(cta).toHaveAttribute('href', DOWNLOAD_LATEST);
    const box = await cta.boundingBox();
    expect(box!.height, 'the download button must stay a comfortable tap target').toBeGreaterThanOrEqual(44);
  });

  test('the Mac button downloads the disk image itself, by its stable name (L-261)', async ({ page }) => {
    const cta = page.getByRole('link', { name: /download cviper light for mac/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', DOWNLOAD_MAC_LATEST);
    const box = await cta.boundingBox();
    expect(box!.height, 'the Mac button must stay a comfortable tap target').toBeGreaterThanOrEqual(44);
  });

  test('the page no longer says macOS is not offered', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText(/macOS and Linux are not offered/);
  });

  test('no in-page download link points at the release PAGE instead of the file', async ({ page }) => {
    // Forbid-list (LESSON-033): /releases/latest on its own is the page with
    // seven files to choose from, which is what the button stopped doing in
    // L-245. The FAQ kept the old link for a while after the button changed.
    // /releases/latest/download/<name> is the file itself and is allowed.
    const hrefs = await page.locator('a[href]').evaluateAll((links) =>
      links.map((a) => (a as HTMLAnchorElement).href)
    );
    const offenders = hrefs.filter((href) => /\/releases\/latest(?!\/download\/)/.test(href));
    expect(offenders, 'links to the release page where the installer itself was meant').toEqual([]);
  });

  test('the FAQ download answer links the installer itself and the Windows-warning help', async ({ page }) => {
    const answer = page.locator('details', { hasText: 'How do I download it?' });
    await expect(answer.locator(`a[href="${DOWNLOAD_LATEST}"]`)).toHaveCount(1);
    await expect(answer.locator(`a[href="${DOWNLOAD_MAC_LATEST}"]`)).toHaveCount(1);
    await expect(answer.locator('a[href="/windows-warning/"]')).toHaveCount(1);
  });

  test('the note under the download button links the Windows-warning help', async ({ page }) => {
    await expect(page.locator('.cta-note a[href="/windows-warning/"]')).toHaveCount(1);
  });

  test('privacy is reachable without JavaScript: real links in nav and footer', async ({ page }) => {
    await expect(page.locator('nav a[href="/privacy/"]')).toHaveCount(1);
    await expect(page.locator('footer a[href="/privacy/"]')).toHaveCount(1);
  });

  test('terms of use are reachable from the footer (L-232)', async ({ page }) => {
    await expect(page.locator('footer a[href="/terms/"]')).toHaveCount(1);
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

test.describe('terms of use page (L-232)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terms/');
  });

  test('renders inside its gutter, with no sideways scroll', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of use');
    await expectLeftGutter(page, 'h1');
    await expectNoSidewaysScroll(page);
  });

  test('says AI output can be wrong and must be checked before it is sent', async ({ page }) => {
    await expect(page.locator('main')).toContainText(/AI can get things wrong/i);
    await expect(page.locator('main')).toContainText(/check (it|everything) before you send/i);
  });

  test('says it is not careers, legal or financial advice', async ({ page }) => {
    await expect(page.locator('main')).toContainText(/not careers, legal or financial advice/i);
  });

  test('names the law that applies: England and Wales', async ({ page }) => {
    await expect(page.locator('main')).toContainText(/laws of England and Wales/i);
  });

  test('carries a date, so a reader can tell which version they read', async ({ page }) => {
    await expect(page.locator('main time[datetime]')).toHaveCount(1);
    const dt = await page.locator('main time[datetime]').getAttribute('datetime');
    expect(dt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('links the privacy policy and the MIT licence', async ({ page }) => {
    await expect(page.locator('main a[href="/privacy/"]')).not.toHaveCount(0);
    await expect(page.locator('main a[href$="/LICENSE"]')).not.toHaveCount(0);
  });

  test('gives the privacy contact that actually receives mail (negative: never privacy@cviper.ai)', async ({ page }) => {
    // cviper.ai has no mail records, so privacy@cviper.ai bounces. The owner
    // chose cviperuk@gmail.com (16 Oct 2026), the same address the app's
    // privacy policy names.
    await expect(page.locator('main a[href="mailto:cviperuk@gmail.com"]')).toHaveCount(1);
    expect(await page.locator('main').innerText()).not.toContain('privacy@cviper.ai');
  });

  test('never promises the AI output is accurate (negative)', async ({ page }) => {
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const promise of ['guaranteed accurate', 'always accurate', 'error-free', 'will get you the job']) {
      expect(text, `must not promise: ${promise}`).not.toContain(promise);
    }
  });
});

test.describe('every sub-page footer links the terms (L-232)', () => {
  for (const url of ['/privacy/', '/windows-warning/', '/terms/']) {
    test(`${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('footer a[href="/terms/"]')).toHaveCount(1);
    });
  }
});

test.describe('Windows warning page', () => {
  test('renders inside its gutter, with no sideways scroll', async ({ page }) => {
    await page.goto('/windows-warning/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Getting past the Windows warning');
    await expectLeftGutter(page, 'h1');
    await expectNoSidewaysScroll(page);
  });

  test('its download link is the installer itself, by the name that never changes', async ({ page }) => {
    await page.goto('/windows-warning/');
    await expect(page.locator(`main a[href="${DOWNLOAD_LATEST}"]`).first()).toBeVisible();
    const hrefs = await page.locator('a[href]').evaluateAll((links) =>
      links.map((a) => (a as HTMLAnchorElement).href)
    );
    expect(hrefs.filter((href) => /\/releases\/latest(?!\/download\/)/.test(href))).toEqual([]);
  });

  test('it shows how to check the file with Get-FileHash', async ({ page }) => {
    await page.goto('/windows-warning/');
    await expect(page.locator('code', { hasText: `Get-FileHash .\\${STABLE_INSTALLER}` })).toHaveCount(1);
  });
});

// No page estimates what AI use costs (cviper-light L-249). The provider sets
// the price and bills the visitor's own account; we cannot know it, so no page
// may say "a few pence", "typically …", or put an amount next to a check. Reads
// the whole rendered text — closed <details> answers included, since
// textContent ignores visibility — plus every meta content, which is what a
// shared link's preview shows.
const COST_ESTIMATE =
  /\bpence\b|\bpenny\b|\bpennies\b|\bcosts? (?:about|around|roughly|only|just|a few)\b|\btypical(?:ly)?\b[^.]{0,60}\bcosts?\b|\bcosts?\b[^.]{0,40}\btypical(?:ly)?\b|[£$€]\s?\d/i;

async function renderedCopy(page: Page): Promise<string> {
  const body = (await page.locator('body').textContent()) ?? '';
  const metas = await page.locator('meta[content]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('content') ?? '')
  );
  return [body, ...metas].join(' ').replace(/\s+/g, ' ');
}

test.describe('no AI cost estimates (L-249)', () => {
  test('the guard catches the shapes it exists for, and passes honest copy', () => {
    for (const bad of [
      'a typical check costs a few pence, paid to them',
      'typically a few pence for a CV check',
      'The welcome screen shows what a check typically costs.',
      'about £0.02 per check',
      'it costs about nothing',
    ]) {
      expect(COST_ESTIMATE.test(bad), `must catch: ${bad}`).toBe(true);
    }
    for (const good of [
      'they bill your own account at their own rates',
      'the provider bills your own account directly, at their published rates',
      'CViper takes no cut.',
      'run a model on your own PC for free',
    ]) {
      expect(COST_ESTIMATE.test(good), `must pass: ${good}`).toBe(false);
    }
  });

  for (const url of ['/', '/privacy/', '/windows-warning/', '/terms/']) {
    test(`${url} says nothing about what an AI check costs`, async ({ page }) => {
      await page.goto(url);
      const match = (await renderedCopy(page)).match(COST_ESTIMATE);
      expect(match?.[0] ?? null, `${url} estimates a cost near: "${match?.input.slice(Math.max(0, (match?.index ?? 0) - 60), (match?.index ?? 0) + 60)}"`).toBeNull();
    });
  }
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
