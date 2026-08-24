import { defineConfig } from 'vite';

// 单机模式（M1/M2/M4/M5）要求"双击即可玩"：
// 构建时把所有 JS/CSS 内联进单个 index.html（inline module 在 file:// 下可运行），
// 产物 dist/index.html 可直接双击打开；图片走网络接口，不打包本地资源。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
