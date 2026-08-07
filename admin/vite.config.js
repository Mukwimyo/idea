import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  base: '/idea/admin/',
  build: {
    outDir: '../dist-admin',
    emptyOutDir: true,
  },
})
