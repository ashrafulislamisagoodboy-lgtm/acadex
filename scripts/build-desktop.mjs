import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const desktopApp = 'desktop-app';
await rm(desktopApp, { recursive: true, force: true });
await mkdir(desktopApp, { recursive: true });
await cp('dist', `${desktopApp}/dist`, { recursive: true });
await cp('public/logo.png', `${desktopApp}/icon.png`);

const project = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(
  `${desktopApp}/package.json`,
  `${JSON.stringify({
    name: project.name,
    productName: 'Acadex',
    version: project.version,
    description: project.description,
    author: project.author,
    type: 'module',
    main: 'main.mjs',
  }, null, 2)}\n`,
);

await build({
  entryPoints: ['desktop/main.ts'],
  outfile: `${desktopApp}/main.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: ['electron', 'vite'],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});
