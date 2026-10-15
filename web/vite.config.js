import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev the Fastify server runs separately on 8080.
    proxy: { '/api': 'http://localhost:8080', '/photos': 'http://localhost:8080' },
  },
});
