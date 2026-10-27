// Source-level forbid-guards (the hosted repo's LESSON-033: a guard encodes
// "Y must be absent", never "X must be present"). Each one holds a promise
// this repository states in prose somewhere; these make the prose executable.
//
// They read files rather than pages, so the config runs them in one project
// only. HTML and CSS comments are stripped before any pattern runs — a
// commented-out example must neither trip a guard nor satisfy one (the class
// cviper-light met as L-168, where comment-blind readers made every manifest
// guard read a planted example).

import { test, expect } from '@playwright/test';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'tests', 'playwright-report', 'test-results']);

function htmlFiles(dir = root): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : htmlFiles(path.join(dir, entry.name));
    }
    return entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : [];
  });
}

const stripHtmlComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '');
const stripCssComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function styleBlocks(html: string): string {
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) blocks.push(stripCssComments(m[1]));
  return blocks.join('\n');
}

test('no page loads anything from another server', () => {
  // The home page says it in its own source: "this site loads no external
  // script, and never will" — and the privacy panel says the site sets no
  // cookies. Both stay true only while no tag fetches from elsewhere.
  // <link rel="canonical"> and og: metas carry absolute URLs without fetching,
  // so the guard targets the elements and rel values that fetch.
  for (const file of htmlFiles()) {
    const html = stripHtmlComments(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(root, file);

    const fetchingSrc = /<(script|img|iframe|source|video|audio|embed|object|track)\b[^>]*\bsrc\s*=\s*["']https?:/i;
    expect(fetchingSrc.test(html), `${rel}: an element fetches from another server`).toBe(false);

    for (const linkTag of html.match(/<link\b[^>]*>/gi) ?? []) {
      if (!/\bhref\s*=\s*["']https?:/i.test(linkTag)) continue;
      expect(
        /\brel\s*=\s*["']canonical["']/i.test(linkTag),
        `${rel}: only rel="canonical" may point off-site, found: ${linkTag}`
      ).toBe(true);
    }

    const css = styleBlocks(html);
    expect(/@import\b/i.test(css), `${rel}: CSS @import`).toBe(false);
    expect(/url\(\s*["']?https?:/i.test(css), `${rel}: CSS fetches from another server`).toBe(false);
  }
});

test('the .hero and .did rules never use the padding or margin shorthand', () => {
  // The README documents this trap: the box shorthand in those rules resets
  // the .wrap container's gutters and centring, pinning text to the viewport
  // edge on mobile. Longhands (padding-block, margin-top, padding-inline...)
  // are fine; only the bare `padding:` / `margin:` shorthand resets.
  // pages.spec.ts guards the rendered symptom; this catches it at the source.
  for (const file of htmlFiles()) {
    const css = styleBlocks(stripHtmlComments(fs.readFileSync(file, 'utf8')));
    const rel = path.relative(root, file);
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(css)) !== null) {
      const [, selector, body] = m;
      if (!/\.(hero|did)\b/.test(selector)) continue;
      expect(
        /(?:^|[;{\s])(padding|margin)\s*:/.test(body),
        `${rel}: "${selector.trim()}" uses a box shorthand — use longhands (see README, "Editing")`
      ).toBe(false);
    }
  }
});

test('every page declares a mobile viewport', () => {
  for (const file of htmlFiles()) {
    const html = stripHtmlComments(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(root, file);
    expect(
      /<meta\s+name=["']viewport["'][^>]*width=device-width/i.test(html),
      `${rel}: missing the device-width viewport meta`
    ).toBe(true);
  }
});

test('sw.js stays a self-destructing worker that serves nothing', () => {
  // Its own header comment is the contract: it exists to unregister the old
  // cloud app's worker. A fetch handler would put a cache back between
  // visitors and the page — the exact defect it was written to end.
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  expect(sw).toContain('unregister');
  expect(/addEventListener\(\s*["']fetch["']/.test(sw), 'sw.js must not serve anything').toBe(false);
});

test('CNAME is a single clean line', () => {
  // GitHub Pages rejects a CNAME with a carriage return or extra content, and
  // the failure mode is the whole domain going dark, not an error message.
  const cname = fs.readFileSync(path.join(root, 'CNAME'), 'utf8');
  expect(cname).toMatch(/^cviper\.ai\n?$/);
});

// ── Colour contrast (cviper-light L-229) ─────────────────────────────────────
// Text must reach WCAG 1.4.3's 4.5:1 in BOTH schemes. Two pairs failed: the
// faint grey on the page background in light mode (4.39:1) and white button
// text on the light-blue accent in dark mode (2.59:1). The guard reads the
// tokens out of each :root block, so changing a colour re-checks every pair.

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every `--name:#hex` in each `:root{...}` block, in order: light first, then dark. */
function rootTokenSets(css: string): Array<Record<string, string>> {
  return [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((block) =>
    Object.fromEntries(
      [...block[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
    ),
  );
}

/**
 * Foreground token on background token, for every text pair each page draws.
 * The privacy page shares the home page's tokens and draws a subset of them;
 * it was left at the old faint grey when the home page was fixed.
 */
const TEXT_PAIRS: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  'index.html': [
    ['ink', 'bg'],
    ['ink-2', 'bg'],
    ['ink-3', 'bg'],
    ['ink-3', 'surface'],
    ['accent', 'bg'],
    ['on-accent', 'accent'],
    ['on-accent', 'accent-hover'],
    ['accent-ink', 'accent-soft'],
  ],
  'privacy/index.html': [
    ['ink', 'bg'],
    ['ink', 'surface'],
    ['ink-2', 'bg'],
    ['ink-3', 'bg'],
    ['accent', 'bg'],
    ['accent-ink', 'accent-soft'],
  ],
};

for (const [page, pairs] of Object.entries(TEXT_PAIRS)) {
  test(`every text colour on ${page} reaches 4.5:1 in light and dark`, () => {
    const css = styleBlocks(stripHtmlComments(fs.readFileSync(path.join(root, page), 'utf8')));
    const [light, dark] = rootTokenSets(css);
    expect(light, 'a light :root block').toBeDefined();
    expect(dark, 'a dark :root block').toBeDefined();
    for (const [scheme, tokens] of [['light', light], ['dark', { ...light, ...dark }]] as const) {
      for (const [fg, bg] of pairs) {
        expect(tokens[fg], `${scheme}: --${fg} is defined`).toBeDefined();
        expect(tokens[bg], `${scheme}: --${bg} is defined`).toBeDefined();
        const ratio = contrast(tokens[fg], tokens[bg]);
        expect(ratio, `${scheme}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

test('text on the accent uses the on-accent token, never a fixed white', () => {
  // A literal #fff passes in light mode and fails in dark, which is how the
  // dark-mode button shipped at 2.59:1.
  const css = styleBlocks(stripHtmlComments(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
  expect(css).not.toMatch(/(?<![-\w])color\s*:\s*#fff(fff)?\b/i);
});

// ── Link previews and authorship (L-245) ─────────────────────────────────────
// A share card reads og:image without a page around it, so a relative path or
// a file that was never committed gives a blank preview with no error anywhere.

function metaContent(html: string, attr: 'name' | 'property', key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = new RegExp(`\\b${attr}\\s*=\\s*["']${key.replace(/[.:]/g, '\\$&')}["']`, 'i');
    if (!k.test(tag)) continue;
    const c = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag);
    return c ? c[1] : '';
  }
  return null;
}

test('og:image is an absolute cviper.ai URL whose file is in this repository', () => {
  const html = stripHtmlComments(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const image = metaContent(html, 'property', 'og:image');
  expect(image, 'index.html declares og:image').not.toBeNull();
  expect(image!).toMatch(/^https:\/\/cviper\.ai\/[^?#]+\.png$/);
  const file = path.join(root, new URL(image!).pathname);
  expect(fs.existsSync(file), `${path.relative(root, file)} exists in the repo`).toBe(true);
  expect(metaContent(html, 'property', 'og:image:width')).toBe('1200');
  expect(metaContent(html, 'property', 'og:image:height')).toBe('630');
  expect(metaContent(html, 'property', 'og:image:alt') ?? '').not.toBe('');
  expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
});

// L-298: the site names no person. The author is the product, "CViper" (the
// owner's choice, 27 Oct 2026, replacing the personal name L-245 set).
test('the home, Windows-warning and terms pages give CViper as their author', () => {
  for (const rel of ['index.html', path.join('windows-warning', 'index.html'), path.join('terms', 'index.html')]) {
    const file = path.join(root, rel);
    expect(fs.existsSync(file), `${rel} exists`).toBe(true);
    const html = stripHtmlComments(fs.readFileSync(file, 'utf8'));
    expect(metaContent(html, 'name', 'author'), `${rel}: author meta`).toBe('CViper');
  }
});

// ── No personal names (L-298) ────────────────────────────────────────────────
// Banned words are listed by SHA-256 so this file is not itself the one that
// names the person. A speed bump, not a secret: the GitHub account name is in
// every repository link, and a link cannot change without moving the repo.
//
// Allowed: the privacy policy and the terms. A privacy notice must name its
// controller (UK GDPR Art. 13), and the terms say who "we" are. Changing them
// is the owner's legal decision, not a find-and-replace — and the privacy page
// must match the app's own copy word for word (privacy-drift.yml).

const BANNED_NAME_HASHES: ReadonlySet<string> = new Set([
  'c7c084318b6f1bece6f74ffce1ea53596070345272dee8040037497c7d4cbffe',
  'f148389d080cfe85952998a8a367e2f7eaf35f2d72d2599a5b0412fe4094d65c',
  '3b9b05c720497601bfacaf66e58e8e37e3545ea9ab671665ad2e72e483c4872f',
  'e745dadf1d8de32bce89880a3a05968436b16de3c99040c7958fddff2b5d75d2',
]);
const NAMES_ALLOWED_IN = new Set([path.join('privacy', 'index.html'), path.join('terms', 'index.html')]);

const sha256 = (word: string): string => crypto.createHash('sha256').update(word).digest('hex');

/** Every banned word in `text`. A word is a run of letters and digits. */
function personalNames(text: string, banned: ReadonlySet<string> = BANNED_NAME_HASHES): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => banned.has(sha256(word)));
}

function siteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'test-results', 'playwright-report', '__screenshots__'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...siteFiles(full));
    else if (/\.(html|css|js|json|xml|txt|webmanifest)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('no published file names a person, outside the privacy policy and terms', () => {
  const files = siteFiles(root);
  expect(files.length).toBeGreaterThan(5);
  const offences = files
    .filter((file) => !NAMES_ALLOWED_IN.has(path.relative(root, file)))
    .flatMap((file) => personalNames(fs.readFileSync(file, 'utf8')).map((w) => `${path.relative(root, file)}: ${w}`));
  expect(offences).toEqual([]);
});

test('the name guard catches a banned word, and only whole words', () => {
  const standIn = new Set([sha256('zebedee')]);
  expect(personalNames('Made by ZEBEDEE.', standIn)).toEqual(['zebedee']);
  expect(personalNames('zebedees zebedee1 github.com/zebedee2/repo', standIn)).toEqual([]);
  expect(personalNames('Stevenage, Bradyville')).toEqual([]);
});
