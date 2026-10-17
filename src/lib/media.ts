/**
 * Media hosting.
 *
 * All images, video and fonts live on Cloudflare R2 (bucket `bms-media`) under `baileysgroup/`, served from
 * https://media.baileysallied.com/baileysgroup/ — never in this repo. The original Webflow CDN URLs are kept in
 * the page data (copied from live) and rewritten here at build time, so the mapping stays visible.
 *
 * - Hero video: re-encoded H.264 MP4 (CRF 23, faststart, no audio track; SSIM 0.99 vs original) + original WebM,
 *   poster converted to WebP.
 * - Logos/icons/favicons: same files as Webflow (SVGs and already-optimized PNGs) under `img/` with their
 *   original file names.
 * - Font: served same-origin via the `/_media/fonts/*` proxy in netlify.toml (R2 has no CORS for fonts);
 *   referenced from the Webflow CSS in public/_webflow.
 * - No AVIF: Cloudflare challenges `.avif` on media.baileysallied.com for crawlers/headless clients (403).
 *
 * `media-manifest.csv` lists every original URL and where it now lives.
 */
export const MEDIA_FROM = 'https://cdn.prod.website-files.com';
export const MEDIA_BASE = 'https://media.baileysallied.com/baileysgroup';

const SITE = `${MEDIA_FROM}/66a811178a7051a0f1cb05d8`;
const VIDEO = `${SITE}%2F66aac2746bc34854196f200a_BCSG%20Intro%20revised`;

/** Ordered: specific files first, then whole folders, then the bare host (preconnect hints). */
const MAP: [string, string][] = [
  [`${VIDEO}-poster-00001.jpg`, `${MEDIA_BASE}/video/bcsg-intro-poster-1280.webp`],
  [`${VIDEO}-transcode.mp4`, `${MEDIA_BASE}/video/bcsg-intro-720.mp4`],
  [`${VIDEO}-transcode.webm`, `${MEDIA_BASE}/video/bcsg-intro-720.webm`],
  [`${SITE}/`, `${MEDIA_BASE}/img/`],
  [`${MEDIA_FROM}/static/`, `${MEDIA_BASE}/img/`],
  [MEDIA_FROM, 'https://media.baileysallied.com'],
];

export function withMedia(html: string): string {
  if (!html) return html;
  for (const [from, to] of MAP) html = html.split(from).join(to);
  return html;
}
