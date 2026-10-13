import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, el front llama a /api y Vite lo redirige al servidor Express.
    proxy: {
      '/api': 'http://localhost:3099',
    },
  },
})
