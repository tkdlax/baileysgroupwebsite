/**
 * Media hosting switch.
 *
 * Phase 1: images, video, fonts are NOT in this repo. They stay on Webflow's CDN
 * (https://cdn.prod.website-files.com/…), listed in media-manifest.csv with the pages they appear on.
 * Webflow's CDN keeps serving them only while the Webflow site exists.
 *
 * To re-host: download everything in media-manifest.csv keeping the `rehost_path`, then set MEDIA_BASE
 * to the new origin (or '' to serve from public/). CSS media: re-run tools/fetch_assets.py after editing it.
 */
export const MEDIA_FROM = 'https://cdn.prod.website-files.com';
export const MEDIA_BASE = 'https://cdn.prod.website-files.com';

export function withMedia(html: string): string {
  if (!html || MEDIA_BASE === MEDIA_FROM) return html;
  return html.split(MEDIA_FROM).join(MEDIA_BASE);
}
