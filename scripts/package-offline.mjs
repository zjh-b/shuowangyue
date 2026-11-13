import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { build } from 'vite';

// The web build serves cacheable files. Vite embeds the same assets for the portable build.
const { output } = await build({
  logLevel: 'warn',
  build: {
    write: false,
    copyPublicDir: false,
    assetsInlineLimit: file => /\.(webp|woff2|mp3)$/.test(file) ? true : undefined,
    chunkSizeWarningLimit: 5000,
  },
});
const html = fileContent('index.html');
const scriptPattern = /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/;
const stylePattern = /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/;
const iconPattern = /<link\s+rel="icon"\s+type="image\/png"\s+href="([^"]+)"\s*\/?>/;
const script = html.match(scriptPattern);
const style = html.match(stylePattern);
const icon = html.match(iconPattern);
if (!script || !style || !icon) throw new Error('无法定位构建后的脚本、样式或图标。');

function findOutput(path) {
  const file = output.find(entry => entry.fileName === posix.normalize(path));
  if (!file) throw new Error(`无法定位构建资源：${path}`);
  return file;
}

function fileContent(path) {
  const file = findOutput(path);
  return file.type === 'chunk' ? file.code : String(file.source);
}

const inlineFiles = new Set([script[1], style[1], icon[1], 'index.html'].map(posix.normalize));
if (output.some(entry => !inlineFiles.has(entry.fileName))) {
  throw new Error('离线版还有单独的资源，无法生成独立的 HTML。');
}
const js = fileContent(script[1]);
const css = fileContent(style[1]);
const iconAsset = findOutput(icon[1]);
if (iconAsset.type !== 'asset' || typeof iconAsset.source === 'string') throw new Error('无效的 PNG 图标。');
const iconUrl = `data:image/png;base64,${Buffer.from(iconAsset.source).toString('base64')}`;
const [projectLicense, fontLicense, musicCredits] = await Promise.all([
  readFile('LICENSE', 'utf8'),
  readFile('public/wordmark-OFL.txt', 'utf8'),
  readFile('public/music-credits.txt', 'utf8'),
]);
const offline = html.replace(scriptPattern, () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace(stylePattern, () => `<style>${css}</style>`)
  .replace(iconPattern, () => `<link rel="icon" type="image/png" href="${iconUrl}">`)
  .replace('<html lang="zh-CN">', '<html lang="zh-CN" data-offline-build>')
  .replace('</head>', () => `<!-- Project license\n${projectLicense}\n-->\n<!-- Font license\n${fontLicense.replace(/--/g, '—')}\n-->\n<!-- Music credits\n${musicCredits}\n-->\n</head>`);
await mkdir('dist', { recursive: true });
await writeFile('dist/朔望月-双击试玩.html', offline);
await writeFile('dist/LICENSE', projectLicense);
console.log('已生成 dist/朔望月-双击试玩.html');
