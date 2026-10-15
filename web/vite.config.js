import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev the Fastify server runs separately on 8080.
    // xfwd passes the browser's original host along (X-Forwarded-Host), which the server's
    // cross-site check uses to recognise this dev page as the same site.
    proxy: {
      '/api': { target: 'http://localhost:8080', xfwd: true },
      '/photos': { target: 'http://localhost:8080', xfwd: true },
      '/icons': { target: 'http://localhost:8080', xfwd: true },
    },
  },
});
