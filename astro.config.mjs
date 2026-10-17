import { defineConfig } from 'astro/config';

// baileysgroup.com phase-1 rebuild (see MIGRATION-STATUS.md).
// - Static output, no adapter (host not chosen yet).
// - trailingSlash 'never' + build.format 'file' emits /contact.html served at /contact (live URLs have no
//   trailing slash). dist/404.html doubles as the host's 404 page, like Webflow's.
// - compressHTML off: content is transplanted live markup; keep it as-is.
export default defineConfig({
  site: 'https://www.baileysgroup.com',
  trailingSlash: 'never',
  compressHTML: false,
  build: { format: 'file' },
});
