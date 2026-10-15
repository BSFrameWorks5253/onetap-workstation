import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/xlsx')) return 'vendor-xlsx'
            if (id.includes('node_modules/pdf-lib')) return 'vendor-pdf'
            if (id.includes('node_modules/marked')) return 'vendor-marked'
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react'
          }
        }
      }
    },
    plugins: [react()]
  }
})
