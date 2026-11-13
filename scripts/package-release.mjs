import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const release = resolve('release');
const dist = resolve('dist');
const offline = '朔望月-双击试玩.html';
const label = `朔望月-v${version}`;
const archive = resolve(release, `${label}-静态网页.zip`);
const deployFiles = ['index.html', 'assets', 'LICENSE', 'wordmark-OFL.txt', 'music-credits.txt'];

await mkdir(release, { recursive: true });
await copyFile(resolve(dist, offline), resolve(release, `${label}-离线试玩.html`));

const tar = process.platform === 'win32' ? 'tar.exe' : 'bsdtar';
execFileSync(tar, ['-a', '-cf', archive, '-C', dist, ...deployFiles], { stdio: 'inherit' });
console.log(`发布包已写入 ${release}`);
