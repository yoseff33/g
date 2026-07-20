import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('framer-motion') || id.includes('/motion/')) return 'motion'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('@google/genai')) return 'genai'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}))
