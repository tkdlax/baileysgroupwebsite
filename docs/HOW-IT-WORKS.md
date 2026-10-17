# How the phase-1 build works

```
live site ──crawl.py────────▶ baseline/raw/html/  (/, /contact, /404 — read-only)
        ├─fetch_assets.py──▶ public/_webflow/    (Webflow CSS/JS + jQuery, copied)
        ├─inventory.py─────▶ media-manifest.csv, baseline/data/third-party.csv
        └─extract.py───────▶ src/chrome/  shared head items, nav, footer
                              src/content/pages/*.json  per page: html/body attrs, page head, main, scripts
                                   │
                       npm run build ──▶ dist/  (index.html, contact.html, 404.html)
                                   │
                       parity.py (DOM vs live) + visual.py (browser screenshots vs live)
```

## Run it
```
npm install && npm run build
npx astro preview --port 4322
python3 tools/parity.py      # expect: 3 checked, 0 with differences
python3 tools/visual.py      # needs preview running
```
Python: `requests beautifulsoup4 html5lib pillow playwright`.

## Pieces
- `src/pages/[...path].astro` serves every URL; `src/layouts/SiteLayout.astro` is the page shell.
- `src/components/Nav.astro` — the nav bar; re-applies Webflow's `w--current` to the current page's links.
- `<html data-wf-page / data-wf-site>` attributes are kept per page: webflow.js uses them.
- `src/lib/form-guard.js` — mockup-only, blocks form submission (the only intended difference from live).
- `src/lib/media.ts` — `MEDIA_BASE` switch for re-hosting Webflow CDN media later.
- `dist/404.html` is served by Netlify / Cloudflare Pages as the 404 page automatically.

Don't re-run `extract.py` after hand-editing `src/content` or `src/chrome` (it overwrites them).
