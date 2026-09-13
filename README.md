# cviper-landing

The static holding page served at **https://cviper.ai** while the CViper hosted
application is paused.

- `index.html` — the home page. No build step, no external requests.
- `privacy/index.html` — the privacy policy, served at `/privacy`. **Not an
  original document**: its content is transcribed from the privacy policy the
  CViper Light app _generates_ from its own host registry
  (`docs/app-store/privacy-policy.md` in `stevenbrady1/cviper-light`, rendered
  by `policyDocument.ts` from `apps/light/src/lib/outbound-hosts.ts` and
  `dataLocations.ts`). **Refresh this page whenever that registry changes** —
  nothing links the two repositories, so the drift would be silent. The full
  provenance and refresh trigger are in a comment at the top of the file.
- `light/privacy/index.html` — a redirect to `/privacy`, because the app's store
  listing already publishes `cviper.ai/light/privacy` as its privacy-policy URL.
  Delete it if that listing is ever repointed.
- `tools/check_privacy_drift.py` — fails when `privacy/index.html` no longer
  says what the app's published policy says. See "Refreshing the privacy page".
- `.github/workflows/privacy-drift.yml` — runs that check daily, on every push
  to `main`, and on demand.
- `CNAME` — tells GitHub Pages the custom domain is `cviper.ai`.
- `.nojekyll` — skips Jekyll processing; this is plain HTML.
- `.gitattributes` — pins line endings to LF so `CNAME` never picks up a
  carriage return, which GitHub Pages would reject.

## How it is served

GitHub Pages, from the `main` branch, root folder. GitHub issues and renews the
HTTPS certificate automatically for `cviper.ai` and `www.cviper.ai`.

`cviper.uk` and `www.cviper.uk` are redirected to `cviper.ai` by a Cloudflare
redirect rule, which returns a real 301 and uses Cloudflare's own certificate.
`index.html` also carries a small JavaScript fallback for the same redirect.

`cviper.ai` is the canonical domain, consistent with ADR-010 and with how the
live application was already configured before it was paused.

> GitHub Pages only certifies the single domain in `CNAME`. Pointing `cviper.uk`
> straight at the GitHub Pages IP addresses would serve a certificate for
> `cviper.ai` and produce a browser security warning, so it is deliberately not
> done that way.

## Editing

Edit `index.html` and push to `main`. Pages redeploys within about a minute.

Two CSS traps to avoid if you change the layout: `.hero` and `.did` must set
padding and margin with longhand properties only. The `padding` or `margin`
shorthand there resets the `.wrap` container's gutters and centring, which pins
the text to the viewport edge on mobile.

## Refreshing the privacy page

`privacy/index.html` is a transcription of a document in another repository:

    stevenbrady1/cviper-light : docs/app-store/privacy-policy.md

The app generates that file from its own list of the addresses it may contact,
and a test in that repository keeps the two byte-identical. So when the app
changes what it contacts or what it stores, this page is wrong until it is
regenerated — and it has been wrong: four app changes (L-92, L-105, L-106,
L-110) shipped while this site still described the old behaviour, including two
live hosts the page did not name at all.

To regenerate:

1. Read the current policy —
   <https://raw.githubusercontent.com/stevenbrady1/cviper-light/main/docs/app-store/privacy-policy.md>
2. Edit `privacy/index.html` so its visible text carries every heading,
   paragraph and bullet of it, keeping the existing structure, styling and the
   provenance comment at the top. Do not paraphrase: the precision is the point.
3. Run `python tools/check_privacy_drift.py` until it says OK.
4. Copy the `sha256` and `commit` values that command prints into the
   **SOURCE STAMP** comment at the top of the page, so the page says which
   version of the app it describes.
5. Commit the page and the stamp together.

The check fetches the policy from `cviper-light` **main** and fails if any
statement of it is missing from the page's rendered text. Extra sections on the
page are allowed — two are marked in the source as coming from elsewhere.

If the workflow goes red, the app changed and this page has not caught up yet.
That is the check working. Regenerate the page; do not soften the check, add a
tolerance, or edit the script to make it pass.

## Related

The application source lives in the private `stevenbrady1/CViper` repository.
The snapshot of the deleted Azure infrastructure and the restore notes are
recorded at the `mothball-2026-09` tag in that repository.
