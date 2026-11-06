import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: { port: 4173 }
})
