# baileysgroup.com → Astro — MIGRATION STATUS

**Read this first.** Running guide and resume point. Update it in the same commit as the work.

## Resume protocol
1. Read this file. 2. Start at **NEXT ACTION**. 3. Mark steps `[x]` with date + result; never mark unverified work done.
4. Commit and push after every finished step.

## GOAL (phase 1)
Get the live www.baileysgroup.com (Webflow, 3 pages) running in Astro, looking identical, at the same URLs.
Same method as `tkdlax/universitymoving`: crawl the live site (no source), capture HTML, convert, verify.
- Media stays on Webflow's CDN for now, listed in `media-manifest.csv` (with pages) for a later re-host.
- Third-party loads listed in `THIRD-PARTY.md` for a keep / rebuild / remove decision.
- Forms inert in the mockup. No tracking exists on the live site.

## LATER (phase 2 — not before phase 1 sign-off)
Redesign / content / URL changes / third-party decisions. Ideas parked in `docs/RECOMMENDATIONS.md`.

## WORKING RULES
- No copy or URL changes in phase 1. `baseline/` is read-only (re-capture: `python3 tools/crawl.py`).
- Commits as Jake with the Claude attribution trailer.

## KEY FILES
| File | What |
|---|---|
| `media-manifest.csv` | 21 media URLs (18 images, 2 videos, 1 font) → pages, context, re-host path |
| `THIRD-PARTY.md` | Webflow code (copied), Google Fonts, reCAPTCHA, Webflow form handling |
| `docs/HOW-IT-WORKS.md` | Pipeline, how to build / verify / edit |
| `docs/RECOMMENDATIONS.md` | Phase-2 notes |
| `baseline/` | Live captures + data (`url-inventory.csv`, `asset-map.json`, reports) |

## CURRENT STATE
**Phase 1 build complete and verified (2026-10-17).**
- 3 pages: `/`, `/contact`, `/404` (Webflow's custom 404, unlinked — found by probing; doubles as the host 404 page).
  Crawl + probes found nothing else. The Webflow site isn't in the connected Webflow account, so the page list
  couldn't be cross-checked against the Webflow API.
- `tools/parity.py`: 3/3 identical to live (html/body attributes, body structure + text, head elements).
- `tools/visual.py` (desktop + mobile): `/404` 0.0%; `/` ≤0.8% (background video frame timing); `/contact` ≤0.3%
  (reCAPTCHA is locked to the live domain and shows a domain error on the mockup).
- No redirects observed besides apex → www (host-level). Empty live robots.txt copied as-is.

## NEXT ACTION
Waiting on Jake: hosting for a preview link; media destination (then download from `media-manifest.csv`, flip
`MEDIA_BASE` in `src/lib/media.ts`); THIRD-PARTY.md decisions.

## STEPS
- [x] 0.1 Repo seeded (2026-10-17)
- [x] 1.1 Crawl: 3 pages (2 linked + /404) (2026-10-17)
- [x] 1.2 Webflow CSS/JS + jQuery copied to `public/_webflow/` (7 files) (2026-10-17)
- [x] 2.1 `media-manifest.csv` — 21 URLs, all Webflow CDN (2026-10-17)
- [x] 2.2 `THIRD-PARTY.md` (2026-10-17)
- [x] 3.1 Astro 7.4 scaffold (same setup as universitymoving / baileysallied) (2026-10-17)
- [x] 3.2 Layout + Nav component (re-applies `w--current`) + shared footer (2026-10-17)
- [x] 4.1 3 page entries in `src/content/pages` (2026-10-17)
- [x] 5.1 Parity 3/3 (2026-10-17)
- [x] 5.2 Visual check, desktop + mobile (2026-10-17)

## NETLIFY / MEDIA (2026-10-17)
- Netlify site `baileysgroup` (team jake-5vgkxtc), repo-linked, production branch `main`, deploy previews on.
  Preview: https://baileysgroup.netlify.app (X-Robots-Tag noindex on *.netlify.app only, edge function).
- All 21 media files on R2 `bms-media/baileysgroup/` (see `src/lib/media.ts`, `media-manifest.csv`). Webflow originals untouched.
- Contact form removed (Jake): /contact links to the brand sites; reCAPTCHA and form-guard removed.
- Not done: custom domain / DNS (Jake), GTM container GTM-NXMXCGTV (separate PR).

## DECISIONS LOG
- 2026-10-17: No templates beyond Nav/Footer/Layout — 3 pages don't need them.
- 2026-10-17: Contact form blocked by `src/lib/form-guard.js` (mockup only): webflow.js would post to the real Webflow inbox.
- 2026-10-17: Body scripts kept per page (shared scripts sit between page-only ones on live; order matters).

## SESSION LOG
- 2026-10-17: Whole phase 1 done in one session.
