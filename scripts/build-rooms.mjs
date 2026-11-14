import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';

const site = process.argv.includes('--sites');
const folder = site ? 'dist/server' : '.local/rooms';
const entry = resolve(site ? 'server/site.mjs' : 'server/roomApi.ts');
const result = await build({
  configFile: false,
  publicDir: false,
  build: {
    target: 'es2022', minify: false, write: false,
    lib: { entry, formats: ['es'] },
  },
});
const builds = Array.isArray(result) ? result : [result];
const bundle = builds.flatMap(build => build.output).find(file => file.type === 'chunk' && file.isEntry);
if (!bundle) throw new Error('未生成联机服务。');
await mkdir(folder, { recursive: true });
await writeFile(resolve(folder, site ? 'index.js' : 'api.mjs'), bundle.code);
