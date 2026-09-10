# cviper-landing

The static holding page served at **https://cviper.uk** while the CViper hosted
application is paused.

- `index.html` — the whole site. One file, no build step, no external requests.
- `CNAME` — tells GitHub Pages the custom domain is `cviper.uk`.
- `.nojekyll` — skips Jekyll processing; this is plain HTML.

## How it is served

GitHub Pages, from the `main` branch, root folder. GitHub issues and renews the
HTTPS certificate automatically for `cviper.uk` and `www.cviper.uk`.

`cviper.ai` and `www.cviper.ai` are redirected to `cviper.uk` by a Cloudflare
redirect rule, which returns a real 301 and uses Cloudflare's own certificate.
`index.html` also carries a small JavaScript fallback for the same redirect.

> GitHub Pages only certifies the single domain in `CNAME`. Pointing `cviper.ai`
> straight at the GitHub Pages IP addresses would serve a certificate for
> `cviper.uk` and produce a browser security warning, so it is deliberately not
> done that way.

## Editing

Edit `index.html` and push to `main`. Pages redeploys within about a minute.

## Related

The application source lives in the private `stevenbrady1/CViper` repository.
Snapshot of the deleted Azure infrastructure and the restore notes: see the
`mothball-2026-09` tag in that repository.
