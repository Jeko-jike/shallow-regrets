/**
 * 构建后处理：把 dist 中的 JS/CSS 内联进单个 index.html，
 * 使产物可双击（file:// 协议）离线运行 —— 满足 M1/M2/M4/M5 单机模式"双击即玩"要求。
 * 用法：npm run build（vite build 后自动执行本脚本）。
 */
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const htmlPath = join(distDir, 'index.html');

let html = readFileSync(htmlPath, 'utf-8');
const assetsDir = join(distDir, 'assets');

// 内联 CSS：<link rel="stylesheet" ... href="./assets/xxx.css">
for (const f of readdirSync(assetsDir).filter((x) => x.endsWith('.css'))) {
  const css = readFileSync(join(assetsDir, f), 'utf-8');
  const linkRe = new RegExp(`<link[^>]*href="\\./assets/${f}"[^>]*>`);
  if (!linkRe.test(html)) throw new Error(`未找到 CSS 引用: ${f}`);
  // 必须用替换函数：替换串里的 $& / $' / $` 等会被 String.replace 当特殊模式处理，
  // 而压缩后的 JS/CSS 里可能恰好含 "$&"（如变量 $ 后跟 &&），导致内联内容被破坏。
  html = html.replace(linkRe, () => `<style>${css}</style>`);
}

// 内联 JS：<script type="module" ... src="./assets/xxx.js"></script>
for (const f of readdirSync(assetsDir).filter((x) => x.endsWith('.js'))) {
  const js = readFileSync(join(assetsDir, f), 'utf-8');
  const scriptRe = new RegExp(`<script[^>]*src="\\./assets/${f}"[^>]*></script>`);
  if (!scriptRe.test(html)) throw new Error(`未找到 JS 引用: ${f}`);
  html = html.replace(scriptRe, () => `<script type="module">${js}</script>`);
}

writeFileSync(htmlPath, html);
rmSync(assetsDir, { recursive: true, force: true });
console.log('已内联 JS/CSS 到 dist/index.html（可双击离线运行）');
