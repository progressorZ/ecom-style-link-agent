import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appId = process.env.ECOM_APP_ID
let portableEntry: string | undefined
let portableTitle: string | undefined
if (appId) {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(appId)) throw new Error('ECOM_APP_ID 格式不正确')
  const manifest = JSON.parse(readFileSync(resolve('apps', appId, 'app.json'), 'utf8')) as { id: string; displayName: string; frontendEntry: string }
  if (manifest.id !== appId || !manifest.frontendEntry?.startsWith('src/')) throw new Error('App manifest 的前端入口无效')
  portableEntry = resolve(manifest.frontendEntry)
  if (!portableEntry.startsWith(resolve('src') + '/')) throw new Error('App 前端入口必须位于 src 目录')
  portableTitle = manifest.displayName
}

const isolatedApp = {
  name: 'isolated-portable-app',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (portableEntry && source === './App' && importer?.replaceAll('\\', '/').endsWith('/src/main.tsx')) return '\0portable-app-entry'
  },
  load(id: string) {
    if (id === '\0portable-app-entry') return `export { default } from ${JSON.stringify(portableEntry!)}`
  },
  transformIndexHtml(html: string) {
    return portableTitle ? html.replace(/<title>.*?<\/title>/, `<title>${portableTitle}</title>`) : html
  }
}

export default defineConfig({
  plugins: [react(), isolatedApp],
  define: { 'import.meta.env.VITE_ECOM_APP_ID': JSON.stringify(appId ?? '') },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api/live': 'http://127.0.0.1:4318' } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api/live': 'http://127.0.0.1:4318' } },
  test: { exclude: ['scripts/**', 'node_modules/**', 'dist/**', 'release/**'] }
})
