import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Generated from the live site by tools/extract.py (see MIGRATION-STATUS.md).
const pages = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/pages', generateId: ({ entry }) => entry.replace(/\.json$/, '') }),
  schema: z.object({
    url: z.string(),
    htmlAttrs: z.record(z.string(), z.string()), // data-wf-page / data-wf-site: webflow.js needs them
    bodyAttrs: z.record(z.string(), z.string()),
    headPage: z.array(z.string()), // head items only this page has (title, description, OG…)
    hasNav: z.boolean(),
    hasFooter: z.boolean(),
    navCurrent: z.array(z.string()).optional(), // hrefs Webflow marked w--current on this page
    main: z.string(), // live HTML between the nav and the footer
    tailPage: z.array(z.string()), // page-only scripts, after the shared ones
  }),
});

export const collections = { pages };
