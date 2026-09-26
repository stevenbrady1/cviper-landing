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
