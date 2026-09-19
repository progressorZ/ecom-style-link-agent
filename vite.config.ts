import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api/live': 'http://127.0.0.1:4318' } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api/live': 'http://127.0.0.1:4318' } },
  test: { exclude: ['scripts/**', 'node_modules/**', 'dist/**', 'release/**'] }
})
