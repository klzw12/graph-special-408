import { defineConfig } from 'vite'

// base 由构建命令决定：
//   本地      vite                       → '/'
//   GH Pages  vite build --base /<repo>/  → '/<repo>/'
// 资源绝对路径的适配见 src/main.js（使用 import.meta.env.BASE_URL）
export default defineConfig({
  root: '.',
  server: { host: '0.0.0.0', port: 5173 },
  build: { outDir: 'dist' },
})
