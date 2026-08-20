import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildStamp } from './buildstamp';

export default defineConfig(({ command }) => ({
  plugins: [react(), buildStamp()],
  base: command === 'build' ? '/griette-coach/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
}));
