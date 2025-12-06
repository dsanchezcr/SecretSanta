import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Custom plugin to suppress CSS parsing warnings
const suppressCSSWarnings = {
  name: 'suppress-css-warnings',
  apply: 'build',
  enforce: 'post',
  configResolved() {
    // Store original console.log
    const originalLog = console.log
    const originalWarn = console.warn
    
    // Override console methods to filter warnings
    console.log = function(...args) {
      const message = args.join(' ')
      if (!message.includes('Unexpected token ParenthesisBlock') && !message.includes('Found 3 warnings')) {
        originalLog.apply(console, args)
      }
    }
    console.warn = function(...args) {
      const message = args.join(' ')
      if (!message.includes('Unexpected token ParenthesisBlock') && !message.includes('Found 3 warnings')) {
        originalWarn.apply(console, args)
      }
    }
  }
}

// Custom plugin to copy staticwebapp.config.json to dist folder
const copyStaticWebAppConfig = {
  name: 'copy-staticwebapp-config',
  apply: 'build',
  closeBundle() {
    const source = path.resolve(__dirname, 'staticwebapp.config.json')
    const dest = path.resolve(__dirname, 'dist', 'staticwebapp.config.json')
    
    // Ensure the source file exists
    if (!fs.existsSync(source)) {
      console.warn('⚠ Warning: staticwebapp.config.json not found, skipping copy')
      return
    }
    
    // Ensure the dist directory exists
    const distDir = path.dirname(dest)
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true })
    }
    
    fs.copyFileSync(source, dest)
    console.log('✓ Copied staticwebapp.config.json to dist/')
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    suppressCSSWarnings,
    copyStaticWebAppConfig,
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      }
    }
  },
  build: {
    cssMinify: 'esbuild',
  },
});
