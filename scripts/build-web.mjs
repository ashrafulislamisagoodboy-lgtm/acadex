import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const output = 'web-app';
await rm(output, { recursive: true, force: true });
await mkdir(`${output}/server`, { recursive: true });
await mkdir(`${output}/data`, { recursive: true });
await cp('dist', `${output}/dist`, { recursive: true });

const project = JSON.parse(await readFile('package.json', 'utf8'));

await build({
  entryPoints: ['server/index.ts'],
  outfile: `${output}/server/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: ['vite'],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});

await writeFile(`${output}/package.json`, `${JSON.stringify({
  name: `${project.name}-web`,
  productName: 'Acadex Web',
  version: project.version,
  description: `${project.description} Web server distribution.`,
  private: true,
  type: 'module',
  scripts: { start: 'node server/index.mjs' },
  engines: { node: '>=24.0.0' },
}, null, 2)}\n`);

await writeFile(`${output}/start-web.bat`, `@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\nwhere node >nul 2>nul || (\r\n  echo Node.js 24 or later is required.\r\n  echo Download it from https://nodejs.org/\r\n  pause\r\n  exit /b 1\r\n)\r\nif not defined HOST set "HOST=0.0.0.0"\r\nif not defined PORT set "PORT=3000"\r\nnode server/index.mjs\r\nif errorlevel 1 pause\r\n`);

await writeFile(`${output}/start-web.sh`, `#!/usr/bin/env sh\nset -eu\ncd "$(dirname "$0")"\n: "\${HOST:=0.0.0.0}"\n: "\${PORT:=3000}"\nexport HOST PORT\nexec node server/index.mjs\n`, { mode: 0o755 });

await writeFile(`${output}/.env.example`, `# Web server\nHOST=0.0.0.0\nPORT=3000\nACADEX_DATA_DIR=./data\n\n# Set both when Acadex is behind one trusted HTTPS reverse proxy.\nTRUST_PROXY=false\nSECURE_COOKIES=false\n\n# Optional AI imports\nGEMINI_API_KEY=\nGEMINI_MODEL=gemini-2.5-flash\n`);

await writeFile(`${output}/data/README.txt`, `Acadex creates acadex.sqlite in this folder.\r\nStop the server before copying this folder for a backup.\r\nKeep it private because it contains accounts and student data.\r\n`);

await writeFile(`${output}/README.txt`, `ACADEX WEB ${project.version}\r\n\r\nREQUIREMENT\r\n  Node.js 24 or later: https://nodejs.org/\r\n\r\nWINDOWS\r\n  Double-click start-web.bat.\r\n\r\nLINUX OR MACOS\r\n  Run: ./start-web.sh\r\n\r\nOPEN THE APP\r\n  On this computer: http://localhost:3000\r\n  On another device: use the Network address printed by the server.\r\n  Allow Node.js through the firewall if your operating system asks.\r\n\r\nDATA\r\n  The SQLite database is stored in data/acadex.sqlite. Stop the server before\r\n  backing up or moving the data folder. No Firebase account is used.\r\n\r\nCONFIGURATION\r\n  Environment variables can set HOST, PORT, and ACADEX_DATA_DIR. The optional\r\n  AI import tools require GEMINI_API_KEY. For public hosting, use HTTPS and set\r\n  TRUST_PROXY=true and SECURE_COOKIES=true behind one trusted reverse proxy.\r\n`);

console.log(`Acadex Web ${project.version} created in ${output}`);
