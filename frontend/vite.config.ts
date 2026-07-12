import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    // host: true -> bind ke semua interface jaringan agar dapat diakses
    // dari perangkat lain di WiFi yang sama (mis. HP di https://<ip-mac>:5173).
    host: true,
    // Proxy /api ke backend Go. Frontend memanggil path relatif "/api/v1/..."
    // (same-origin, HTTPS), Vite meneruskan ke backend HTTP di localhost:8080.
    // Ini menghindari mixed-content (HTTPS -> HTTP) dan CORS sekaligus.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
