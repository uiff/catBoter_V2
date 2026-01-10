import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://192.168.0.18:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // Optimize bundle size
    target: 'esnext',
    minify: 'esbuild', // Use esbuild for faster builds
    rollupOptions: {
      output: {
        // Code splitting strategy
        manualChunks: {
          // Vendor chunk: React and core libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI chunk: Framer Motion and Lucide icons
          ui: ['framer-motion', 'lucide-react'],
          // Charts chunk: Recharts library
          charts: ['recharts'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit (for initial assessment)
    chunkSizeWarningLimit: 600,
    // Enable source maps for debugging (optional, can be disabled for production)
    sourcemap: false,
  },
})
