import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function spaFallbackPlugin(): Plugin {
  return {
    name: 'spa-fallback',
    closeBundle() {
      try {
        const outDir = path.resolve(__dirname, 'dist')
        const indexHtml = path.join(outDir, 'index.html')
        const notFoundHtml = path.join(outDir, '404.html')
        if (fs.existsSync(indexHtml)) {
          fs.copyFileSync(indexHtml, notFoundHtml)
        }
      } catch (e) {
        console.warn('Could not copy index.html to 404.html:', e)
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  publicDir: 'public',
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: { port: 4173 }
})
