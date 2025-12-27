// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/cli.ts', 'src/bin/bash-complete.ts'],
  format: ['esm'],
  tsconfig: 'tsconfig.json',
  clean: true,
  splitting: true,
  minify: true,
});
