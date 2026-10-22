import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000,
      },
      '/hubs': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        ws: true,
        timeout: 600000,
        proxyTimeout: 600000,
      }
    }
  }
})
