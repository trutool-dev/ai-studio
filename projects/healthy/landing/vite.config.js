import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function stripReactRefreshFromVanilla(filenames) {
  return {
    name: 'strip-react-refresh-from-vanilla',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const isVanilla = filenames.some(f => ctx.filename?.endsWith(f))
        if (!isVanilla) return html
        // Elimina el preamble inyectado por @vitejs/plugin-react
        return html.replace(
          /<script type="module">[\s\S]*?__vite_plugin_react_preamble_installed__[\s\S]*?<\/script>\s*/,
          ''
        )
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    stripReactRefreshFromVanilla(['index4.html']),
  ],
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: 'index4.html',
    },
  },
  publicDir: 'public',
  server: {
    open: '/index3.html',
  },
})
