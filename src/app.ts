import { buildApplication, buildCommand } from '@stricli/core';
import { description, version } from '@/../package.json';
import { OUTPUT_BASE_DIR } from '@/constants';

const command = buildCommand({
  loader: async () => import('./impl'),
  parameters: {
    positional: {
      kind: 'array',
      parameter: {
        brief:
          'List of document urls to scrape from Gallica (e.g., "https://gallica.bnf.fr/ark:/12148/bpt6k42278868", "https://gallica.bnf.fr/ark:/12148/bpt6k42472912")',
        parse: String,
      },
    },
    flags: {
      outDir: {
        kind: 'parsed',
        brief: `Output directory. Default to "${OUTPUT_BASE_DIR}/<document-name>"`,
        parse: String,
        optional: true,
      },
      toPdf: {
        kind: 'boolean',
        brief: 'Convert downloaded images to a single PDF file',
        optional: true,
      },
      ignoreCompleted: {
        kind: 'boolean',
        brief:
          'Skip downloading if all images already exist in the output directory, or PDF already exists if --toPdf is set',
        optional: true,
      },
      overwrite: {
        kind: 'boolean',
        brief:
          'Overwrite existing files if they already exist in the output directory',
        optional: true,
      },
    },
  },
  docs: {
    brief: description,
  },
});

export const app = buildApplication(command, {
  name: 'gallica-scraper',
  versionInfo: {
    currentVersion: version,
  },
});
