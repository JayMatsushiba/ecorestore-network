import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api goes to a verify service on the host
    // (`npx tsx verify/server.ts`, or the compose stack's published port).
    proxy: {
      '/api': { target: process.env['VERIFY_URL'] ?? 'http://127.0.0.1:8090', changeOrigin: true },
    },
  },
})
