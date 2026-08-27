import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/rbmt': {
        target: 'https://www.rbmt.org.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rbmt/, ''),
      },
    },
  },
})
