import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// İki sayfa: yüzen widget ve ayarlar penceresi.
export default defineConfig({
  clearScreen: false,
  server: { port: 5180, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'chrome110',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        settings: resolve(import.meta.dirname, 'settings.html'),
      },
    },
  },
})
