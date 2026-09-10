# cviper-landing

The static holding page served at **https://cviper.ai** while the CViper hosted
application is paused.

- `index.html` — the whole site. One file, no build step, no external requests.
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

## Related

The application source lives in the private `stevenbrady1/CViper` repository.
The snapshot of the deleted Azure infrastructure and the restore notes are
recorded at the `mothball-2026-09` tag in that repository.
