# Third-party tools, popups and load-ins — running list

Everything on the live site that loads from somewhere else, and what the phase-1 mockup does with it.
**Decision** is Jake's, made 1:1 later: **Keep**, **Rebuild** (our own), or **Remove**.
Machine-generated detail: `baseline/data/third-party.csv` (re-run `python3 tools/inventory.py`).

No tracking found on the live site (no GTM, GA, pixels, chat).

## A. Platform (Webflow) — code copied into the repo
| # | Item | What it does | Where | Mockup | Decision |
|---|---|---|---|---|---|
| A1 | Webflow site CSS (`baileys-group.webflow.shared…css`) | All styling | all pages | Copied to `public/_webflow/` | |
| A2 | Webflow JS (`webflow.*.js`, `webflow.schunk.*.js`) | Nav menu, background video, forms, interactions | all pages | Copied to `public/_webflow/` | |
| A3 | jQuery 3.5.1 (Webflow's CloudFront) | Required by webflow.js | all pages | Copied to `public/_webflow/js/` | |
| A4 | Webflow CDN media (`cdn.prod.website-files.com`) | Logos, video, favicon, font | all pages | **Moved to R2 2026-10-17** (`media.baileysallied.com/baileysgroup/`) — see `media-manifest.csv` | |

## B. Third-party loads (kept)
| # | Tool | What it does | Where | Mockup | Decision |
|---|---|---|---|---|---|
| B1 | Google WebFont loader (`ajax.googleapis.com`) + Google Fonts | Loads Open Sans, Montserrat, Lato, Roboto | all pages | Kept | |
| ~~B2~~ | ~~Google reCAPTCHA v2~~ **Removed 2026-10-17 (form removed)** (`recaptcha/api.js`, site key `6LfTgd…`) | Spam check on the contact form; script is loaded on every page | `/contact` (widget) | Kept — key is locked to the live domain, so the widget shows a "not in the list of supported domains" error on the mockup | |
| ~~B3~~ | ~~Webflow form handling~~ **Removed 2026-10-17: Jake removed the contact form; /contact now links to the brand sites** | Contact form submits to the live site's Webflow form inbox | `/contact` | **Disabled** in the mockup by a small guard script (`src/lib/form-guard.js`) so test submissions never reach the real inbox | |

## C. Outbound links (not load-ins; for reference)
baileysallied.com (incl. careers, quote.baileysallied.com), baileyslogistics.com, ADP Workforce Now (careers),
LinkedIn, YouTube.

## Notes for phase 2
- The contact form depends on Webflow. A new form backend is needed before Webflow is cancelled.
- reCAPTCHA loads on all three pages but is only used on `/contact`.
- Four Google Font families load on every page; check which are actually used.
