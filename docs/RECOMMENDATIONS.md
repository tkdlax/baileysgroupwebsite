# Phase-2 recommendations (noticed during migration — NOT acted on)

- **No sitemap.xml** (404) and **robots.txt is an empty file**. Add a sitemap and reference it from robots.txt. (The empty robots.txt is copied to `public/` as-is.)
- **Copyright year** in the footer says 2024.
- **Typo in the homepage meta description:** "one of it's family of brands" (should be "its").
- Webflow's 404 page is a stock "Page Not Found" with no navigation back to the site.
- The homepage background video ships MP4 + WebM from Webflow's CDN; re-host both before cancelling Webflow.
- Contact form needs a non-Webflow backend (see THIRD-PARTY.md B3).
- Only 2 real pages: there is room for a brand-level About / History / Leadership / Careers hub if the
  group site is meant to carry weight (Bailey's Group context skill has the material).
