import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, './src/common'),
      '@mechanics': path.resolve(__dirname, './src/mechanics'),
      '@games': path.resolve(__dirname, './src/games'),
    },
  },
});
