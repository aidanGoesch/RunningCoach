import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Check if we're building for mobile (Capacitor) or web (GitHub Pages)
const isMobileBuild = process.env.CAPACITOR === 'true' || process.env.BUILD_TARGET === 'mobile';

export default defineConfig({
  plugins: [react()],
  // Use root path for mobile, GitHub Pages path for web
  base: isMobileBuild ? '/' : '/RunningCoach/',
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    // Ensure proper chunking for mobile
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  // Configure public directory to not interfere with routes
  publicDir: 'public'
})
